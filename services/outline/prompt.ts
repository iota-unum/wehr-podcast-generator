
export const generateOutlinePrompt = (text: string): string => {
  const role = "Sei un professore esperto di una scuola superiore italiana. Devi preparare uno schema di lezione per aiutare i tuoi studenti a superare un'interrogazione su questo argomento.";
  const task = "Il tuo compito è generare una mappa mentale strutturata in formato JSON basata sul testo fornito. Devi estrarre SOLO le idee principali, i concetti chiave e i passaggi logici fondamentali che un professore italiano si aspetta che uno studente sappia durante un'interrogazione. Ignora dettagli troppo specialistici o accademici se non sono essenziali per la comprensione scolastica.";
  const rules = [
    "**LIMITE DI PAROLE:** Ogni campo 'title', a tutti i livelli, NON DEVE superare le 3 parole.",
    "**UNICITÀ:** I titoli delle 5 idee principali devono essere unici tra loro. Allo stesso modo, i titoli delle sotto-idee che appartengono allo stesso genitore devono essere unici tra loro.",
    "**LINGUA:** L'intero output JSON deve essere in italiano.",
    "**FORMATO:** Attieniti rigorosamente allo schema JSON fornito.",
    "**FORMATO ID:** Gli `id` DEVONO seguire rigorosamente la numerazione gerarchica numerica (es. '1', '1.1', '1.2.1').",
    "**PROSPETTIVA SCOLASTICA:** Seleziona i nodi pensando: 'Cosa chiederei sicuramente in una verifica su questo testo?'. Includi cause, conseguenze e definizioni principali."
  ];

  return `
${role}
${task}

**REGOLE FONDAMENTALI:**
${rules.map(rule => `- ${rule}`).join('\n')}

**Testo da analizzare:**
---
${text}
---
`;
};
