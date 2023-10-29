import { createContext } from 'react';
import { TemplateEntry } from '@bexio-chrome-extension/shared/types';

export interface TemplateContextType {
    templates: TemplateEntry[];
    reloadData: () => void;
}

export const TemplateContext = createContext<TemplateContextType>({
    templates: [],
    reloadData: () => {
        // This is just a fake implementation to make TypeScript happy.
        // The real implementation is in the TemplateContextProvider.
        console.log("reloadData not implemented")
    },
});