
import { MainIdea } from '../../types';

export const generateSummaryPrompt = (
  idea: MainIdea,
  originalText: string,
  previousSummary: string | null
): string => {
  const role = "Sei un tutor scolastico eccellente, specializzato nel preparare studenti di scuola superiore italiana per le interrogazioni.";
  const task = "Il tuo compito è creare un riassunto per questa specifica sezione che contenga tutte le informazioni necessarie per prendere un ottimo voto. È ASSOLUTAMENTE FONDAMENTALE seguire le regole di lunghezza e contenuto.";
  const output_format = "Il riassunto deve essere in formato markdown.";
  
  const rules = [
    "**REGOLA DI LUNGHEZZA CRITICA:** Il riassunto per questa singola idea DEVE essere di **MASSIMO 400 parole**.",
    "**FOCUS INTERROGAZIONE:** Il testo deve evidenziare ciò che i professori chiedono tipicamente: **Date fondamentali, Nomi propri importanti, Definizioni tecniche precise e Nessi Causa-Effetto**. Se nel testo originale ci sono date o termini specifici, DEVI includerli.",
    "**Linguaggio:** Usa un registro formale ma chiaro, adatto a uno studente liceale. Spiega i termini complessi se necessario.",
    "**Struttura Heading:** Utilizza la seguente gerarchia di heading markdown: `#` (H1) per l'idea principale, `##` (H2) per le sotto-idee, `###` (H3) per le sotto-idee annidate.",
    "**Corrispondenza Titoli:** Il testo di ogni heading DEVE CORRISPONDERE ESATTAMENTE al campo `title` dell'idea/sotto-idea nel JSON.",
    "**Nessun Testo Introduttivo:** Inizia IMMEDIATAMENTE con l'heading H1 (`#`). Niente frasi introduttive prima del titolo.",
    "**Contenuto:** Sotto ogni heading, scrivi un paragrafo riassuntivo basato sul 'Testo Originale', focalizzato esclusivamente su quell'idea."
  ];

  const ideaContext = JSON.stringify(idea, null, 2);

  let prompt = `
${role}
${task}
${output_format}

**ISTRUZIONI FONDAMENTALI (da seguire con la massima precisione):**
${rules.map(rule => `- ${rule}`).join('\n')}

**CONTESTO:**
Analizza il "Testo Originale" e crea un riassunto che segua rigorosamente la "Struttura Idea" fornita.

**Struttura Idea (focus di questo riassunto):**
\`\`\`json
${ideaContext}
\`\`\`
`;

  if (previousSummary) {
    prompt += `
**Contesto Precedente (riassunto dell'idea precedente):**
---
${previousSummary}
---
**Istruzione Chiave:** Assicurati che il nuovo riassunto si colleghi in modo naturale al "Contesto Precedente".
`;
  }

  prompt += `
**Testo Originale (da cui estrarre le informazioni):**
---
${originalText}
---

**Output Atteso:**
Scrivi solo il riassunto in formato markdown per la "Struttura Idea" fornita. Inizia DIRETTAMENTE con un heading H1.
`;

  return prompt;
};
