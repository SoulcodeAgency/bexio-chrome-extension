import { createContext } from 'react';
import { TemplateEntry } from '../../types';

export const TemplateContext = createContext<TemplateEntry[]>([]);
