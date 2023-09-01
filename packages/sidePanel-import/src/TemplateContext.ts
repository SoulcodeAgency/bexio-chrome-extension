import { createContext } from 'react';
import { TemplateEntry } from '@bexio-chrome-extension/shared/types';

export const TemplateContext = createContext<TemplateEntry[]>([]);