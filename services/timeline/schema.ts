import { Type } from '@google/genai';

export const timelineEventSchema = {
  type: Type.OBJECT,
  properties: {
    date: { type: Type.STRING, description: 'La data precisa dell\'evento (es. "1789", "14 Luglio 1789", "IV secolo a.C.").' },
    event: { type: Type.STRING, description: 'Una descrizione concisa dell\'evento (massimo 15 parole).' },
    nodeId: { type: Type.STRING, description: 'L\'ID del nodo del JSON di input in cui è stato trovato questo evento.' },
  },
  required: ['date', 'event', 'nodeId'],
};

export const timelineSchema = {
  type: Type.OBJECT,
  properties: {
    events: {
      type: Type.ARRAY,
      description: 'Un array di eventi storici in ordine cronologico.',
      items: timelineEventSchema,
    },
  },
  required: ['events'],
};
