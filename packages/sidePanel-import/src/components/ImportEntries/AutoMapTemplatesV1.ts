import { getTemplateName } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { ImportRow } from "./ImportEntries";

export function autoMapTemplatesV1(
  importData: ImportRow[],
  templateEntries: TemplateEntry[],
  importHeader: ImportRow,
  tagColumnIndexes: number[]
) {
  const importTemplateAssignment: string[] = [];
  importData.forEach((row, rowIndex) => {
    console.groupCollapsed(`Entry ${rowIndex + 1}`);
    const mappingResult: { [key: string]: number } = {};
    const tagColumnsContent = tagColumnIndexes.map((index) => row[index]);
    // Split content of every tag column by space to search for every word
    tagColumnsContent.forEach((tagColumn, columnIndex) => {
      const tagWords = tagColumn.match(/[a-zA-Z0-9]+/g);
      console.log(
        `Identified words in ${importHeader[columnIndex]}:`,
        tagWords
      );
      // Count how many times each word occurs in the templateEntries and count them up
      tagWords?.length &&
        tagWords.map((tagWord) => {
          if (tagWord === "") return;
          tagWord = tagWord.toLowerCase();
          templateEntries.map((entry) => {
            let matches = 0;
            // Give points for the following columns if they match the tagWord
            entry.templateName.toLowerCase().includes(tagWord)
              ? matches++
              : null;
            entry.contact
              ? entry.contact.toLowerCase().includes(tagWord)
                ? matches++
                : null
              : null;
            entry.project
              ? entry.project.toLowerCase().includes(tagWord)
                ? matches++
                : null
              : null;
            entry.package
              ? entry.package.toLowerCase().includes(tagWord)
                ? matches++
                : null
              : null;
            entry.contactPerson
              ? entry.contactPerson.toLowerCase().includes(tagWord)
                ? matches++
                : null
              : null;
            entry.keywords
              ? entry.keywords.toLowerCase().includes(tagWord)
                ? matches++
                : null
              : null;

            // Make the count weight increase for every column: For the first tag column *1, second tag column *2, third tag column *3 etc.
            const countIncrease = matches * (columnIndex + 1);
            mappingResult[entry.id] =
              (mappingResult[entry.id] ?? 0) + countIncrease;
          });
        });
    });

    // Get the key(template id) of the mappingResult which has the highest value
    const templateId = Object.keys(mappingResult).reduce((a, b) =>
      mappingResult[a] > mappingResult[b] ? a : b
    );

    const topTemplateEntry = templateEntries.find(
      (entry) => entry.id === templateId
    );
    if (!topTemplateEntry) {
      console.log("Template not found!");
      console.groupEnd();
      return;
    }
    const templateName = getTemplateName(topTemplateEntry);

    // Check if there is only 1 highest value, otherwise we do not auto map and leave the decision to the user
    const highestValue = Math.max(...Object.values(mappingResult));
    const highestValueCount = Object.values(mappingResult).filter(
      (value) => value === highestValue
    ).length;

    if (highestValueCount === 1) {
      // We have a winner! Assign the template id to the row
      importTemplateAssignment[rowIndex] = templateId;
      console.log(
        "Auto mapping template: " + "TemplateId: " + templateId,
        +"templateName: " + templateName
      );
    } else {
      // No clear winner, leave empty
      console.log("Auto mapping template: No clear winner!");
    }

    // Next stuff is only needed for nice debugging table of points

    // Map over the mappingResult, and replace the index with the template name from templateEntries
    Object.keys(mappingResult).map((templateId) => {
      const templateName = getTemplateName(
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        templateEntries.find((entry) => entry.id === templateId)!
      );
      mappingResult[templateName ?? ""] = mappingResult[templateId];
      delete mappingResult[templateId];
    });

    // Sort the mappingResult by highest value
    const sortedMappingResult: { [key: string]: number } = {};
    Object.keys(mappingResult)
      .sort((a, b) => mappingResult[b] - mappingResult[a])
      .forEach((key) => {
        sortedMappingResult[key] = mappingResult[key];
      });
    console.table(sortedMappingResult);

    console.groupEnd();
  });

  return importTemplateAssignment;
}
