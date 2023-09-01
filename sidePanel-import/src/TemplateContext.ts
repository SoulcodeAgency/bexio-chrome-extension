import { createContext } from 'react';
import { TemplateEntry } from 'shared/types';

export const TemplateContext = createContext<TemplateEntry[]>([]);