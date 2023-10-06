import { createContext } from 'react';
import { TemplateEntry } from '@bexio-chrome-extension/shared/types';

export interface TemplateContextType {
    templates: TemplateEntry[];
    reloadData: () => void;
}

export const TemplateContext = createContext<TemplateContextType>({
    templates: [],
    reloadData: () => {
        console.log("reloadData not implemented")
    },
});