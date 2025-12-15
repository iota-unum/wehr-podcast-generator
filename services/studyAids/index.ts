import { GoogleGenAI, Type } from '@google/genai';
import { Outline, MainIdea, SubIdea, NestedSubIdea, Flashcard, QuizQuestion } from '../../types';
import { generateStudyAidsPrompt } from './prompt';
import { studyAidsSchema } from './schema';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable not set");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type IdeaNode = MainIdea | SubIdea | NestedSubIdea;

const generateAidsForNode = async (node: IdeaNode): Promise<{ flashcards: Flashcard[], quizQuestions: QuizQuestion[] }> => {
    const prompt = generateStudyAidsPrompt(node);
    
    // If the prompt is empty, it means the node and its children have no content, so we skip it.
    if (!prompt) {
        console.log(`[StudyAids] Skipping node "${node.title}" as it has no content.`);
        return { flashcards: [], quizQuestions: [] };
    }

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-lite-preview-09-2025',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: studyAidsSchema,
            },
        });
        
        const result = JSON.parse(response.text);
        
        // Basic validation for quiz questions
        if (result.quizQuestions && Array.isArray(result.quizQuestions)) {
            const quizQuestions: QuizQuestion[] = result.quizQuestions;

            // Derive flashcards directly from the generated quiz questions
            const flashcards: Flashcard[] = quizQuestions.map(quiz => {
                // Ensure the correct answer index is valid before accessing it
                const correctAnswer = quiz.correctAnswerIndex >= 0 && quiz.correctAnswerIndex < quiz.options.length
                    ? quiz.options[quiz.correctAnswerIndex]
                    : 'Risposta non trovata';

                return {
                    front: quiz.question,
                    back: correctAnswer,
                };
            });

            // Return both, as expected by the rest of the app
            return { flashcards, quizQuestions };
        }

        console.warn('Gemini response for study aids was valid JSON but did not contain quizQuestions. Node:', node.title);
        return { flashcards: [], quizQuestions: [] };
    } catch (e) {
        console.error(`Failed to generate study aids for node: ${node.title}`, e);
        
        return { flashcards: [], quizQuestions: [] }; // Return empty on error to not block the whole process
    }
};

const countNodes = (nodes: IdeaNode[]): number => {
    return nodes.reduce((acc, node) => {
        const children = (node as MainIdea).sub_ideas || (node as SubIdea).nested_sub_ideas || [];
        return acc + 1 + countNodes(children);
    }, 0);
};

const processNodeRecursive = async (node: IdeaNode, progress: { count: number, total: number }): Promise<void> => {
    progress.count++;
    console.log(`[StudyAids] [${new Date().toLocaleTimeString()}] Processing node ${progress.count}/${progress.total}: "${node.title}"`);
    
    const aids = await generateAidsForNode(node);
    node.flashcards = aids.flashcards;
    node.quizQuestions = aids.quizQuestions;
    
    if (aids.quizQuestions.length > 0) {
      console.log(`[StudyAids] [${new Date().toLocaleTimeString()}] Successfully generated ${aids.quizQuestions.length} questions for node "${node.title}"`);
    } else {
      console.log(`[StudyAids] [${new Date().toLocaleTimeString()}] No questions generated for node "${node.title}" (either skipped or failed).`);
    }

    const children: IdeaNode[] = (node as MainIdea).sub_ideas || (node as SubIdea).nested_sub_ideas || [];
    
    for (const child of children) {
        await processNodeRecursive(child, progress);
    }
};

export const generateStudyAids = async (finalContentJson: string): Promise<string> => {
    const outline: Outline = JSON.parse(finalContentJson);
    const outlineWithStudyAids: Outline = JSON.parse(JSON.stringify(outline));
    
    const totalNodes = countNodes(outlineWithStudyAids.ideas);
    if (totalNodes === 0) {
        console.log("[StudyAids] No nodes to process. Skipping study aids generation.");
        return JSON.stringify(outlineWithStudyAids, null, 2);
    }

    const progress = { count: 0, total: totalNodes };
    
    console.log(`[StudyAids] Starting generation for ${totalNodes} total nodes.`);

    for (const idea of outlineWithStudyAids.ideas) {
        await processNodeRecursive(idea, progress);
    }
    
    console.log(`[StudyAids] Study aids generation complete. Processed ${progress.count} nodes.`);

    return JSON.stringify(outlineWithStudyAids, null, 2);
};