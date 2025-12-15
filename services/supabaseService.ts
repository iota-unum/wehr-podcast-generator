
import { createClient } from '@supabase/supabase-js';
import { Project } from '../types';

/**
 * Creates a sanitized file name suitable for cloud storage.
 * Replaces invalid characters with underscores, converts to lowercase, and adds a timestamp.
 * Ensures strict ASCII compliance by stripping accents.
 * @param title The original subject/title of the project.
 * @returns A safe, unique file name ending with .mp3.
 */
const createFileNameForStorage = (title: string): string => {
    const sanitized = title
        .normalize("NFD") // Decompose combined characters (e.g., 'è' becomes 'e' + '̀')
        .replace(/[\u0300-\u036f]/g, "") // Remove diacritical marks (the accents)
        .replace(/[^a-zA-Z0-9]/g, '_') // Replace anything that isn't a letter or number with _
        .replace(/_+/g, '_') // Collapse multiple underscores
        .toLowerCase();
        
    return `${sanitized || 'podcast'}-${Date.now()}.mp3`;
};

/**
 * Exports a single completed project to a Supabase instance.
 * 1. Uploads the combined MP3 to Supabase Storage.
 * 2. Inserts the project metadata (script, study materials, audio URL) into a Supabase table.
 * @param supabaseUrl The URL of the Supabase project.
 * @param supabaseKey The public anon key for the Supabase project.
 * @param project The project object from Dexie.
 * @param mp3Blob The combined final audio as a Blob.
 * @returns A promise that resolves with the public URL of the uploaded audio.
 */
export const exportProjectToSupabase = async (
    supabaseUrl: string,
    supabaseKey: string,
    project: Project,
    mp3Blob: Blob
): Promise<{ success: true; audioUrl: string; }> => {
    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase URL and Key are required.');
    }
    
    if (!project.fullScript || !project.studyMaterialsJson) {
        throw new Error(`Project "${project.subject}" is missing required data (script or study materials).`);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Upload MP3 to Supabase Storage
    const fileName = createFileNameForStorage(project.subject);
    const filePath = `public/${fileName}`; 

    const { data: storageData, error: storageError } = await supabase.storage
        .from('podcasts') // NOTE: The bucket must be named 'podcasts' and have appropriate public access policies.
        .upload(filePath, mp3Blob, {
            cacheControl: '3600',
            upsert: false, // Use false to avoid accidentally overwriting files. The timestamp in the name ensures uniqueness.
        });

    if (storageError) {
        throw new Error(`Storage Error: ${storageError.message}`);
    }

    // 2. Get the public URL for the newly uploaded file
    const { data: urlData } = supabase.storage
        .from('podcasts')
        .getPublicUrl(storageData.path);

    if (!urlData || !urlData.publicUrl) {
        throw new Error('Could not retrieve public URL for the uploaded audio.');
    }
    const audioUrl = urlData.publicUrl;

    // 3. Prepare data and insert it into the 'podcast' table
    
    // Parse Study Materials
    let studyMaterialsObj: any = {};
    try {
        studyMaterialsObj = JSON.parse(project.studyMaterialsJson);
    } catch (e) {
        console.warn("Error parsing studyMaterialsJson for export", e);
        studyMaterialsObj = {};
    }

    // Parse Timeline and merge into Study Materials
    if (project.timelineJson) {
        try {
            const timelineObj = JSON.parse(project.timelineJson);
            // We assume timelineObj is { events: [...] }
            // Add the events array to the studyMaterials object under the key 'timeline'
            studyMaterialsObj.timeline = timelineObj.events || [];
        } catch (e) {
            console.warn("Error parsing timelineJson for export", e);
        }
    }

    const podcastData = {
        subject: project.subject,
        full_script: project.fullScript,
        // Store the combined object (Flashcards + Quiz + Timeline) as JSONB
        study_materials: studyMaterialsObj,
        audio_url: audioUrl,
        created_at: project.createdAt,
    };

    const { error: dbError } = await supabase
        .from('podcast') // NOTE: The table must be named 'podcast'.
        .insert([podcastData]);

    if (dbError) {
        // If the database insert fails, try to remove the file that was just uploaded to avoid orphaned files.
        await supabase.storage.from('podcasts').remove([filePath]);
        
        // Check for unique constraint violation
        if (dbError.message.includes('duplicate key value violates unique constraint')) {
            throw new Error(`A project with the subject "${project.subject}" already exists in the database.`);
        }

        const errorMessage = dbError.message || JSON.stringify(dbError);
        throw new Error(`Database Error: ${errorMessage}`);
    }

    return { success: true, audioUrl };
};
