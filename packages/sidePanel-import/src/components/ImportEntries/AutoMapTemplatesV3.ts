import { getTemplateName } from "@bexio-chrome-extension/shared";
import { TemplateEntry } from "@bexio-chrome-extension/shared/types";
import { ImportRow } from "./ImportEntries";

// New mapper function
export function autoMapTemplatesV3(
  importData: ImportRow[],
  templateEntries: TemplateEntry[],
  importHeader: ImportRow,
  tagColumnIndexes: number[]
) {
  const lowPrio = 1;
  const mediumPrio = 3;
  const highPrio = 7;

  const importTemplateAssignment: string[] = [];

  importData.forEach((row, rowIndex) => {
    console.groupCollapsed(`Entry ${rowIndex + 1}`);
    // Fall back to "" for columns the row does not have — a short row must not
    // blow up the whole auto-mapping run with a TypeError on `.match()`.
    const tagColumnsContent = tagColumnIndexes.map((index) => row[index] ?? "");
    // Buckets are keyed by template `id`, not by name: two distinct templates may
    // legitimately share the same name, and merging their points into one bucket
    // would inflate the total and bypass the tie detection below. The display name
    // is carried inside the bucket instead.
    const pointsByTemplateId: {
      [key: string]: {
        name: string;
        total: number;
        points: { [key: string]: number };
      };
    } = {};

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
          // Empty or single characters are not worth searching for
          if (tagWord.length <= 1) return;
          tagWord = tagWord.toLowerCase();
          templateEntries.map((entry) => {
            let matches = 0;
            // Give points for the following columns if they match the tagWord as single word
            // Note: go through getTemplateName - v0.4.x templates have no templateName field
            const templateName = getTemplateName(entry).toLowerCase();
            const templateNameWords = templateName.split(" ");
            const contactWords = entry.contact
              ? entry.contact.toLowerCase().split(" ")
              : [];
            const projectWords = entry.project
              ? entry.project.toLowerCase().split(" ")
              : [];
            const packageWords = entry.package
              ? entry.package.toLowerCase().split(" ")
              : [];
            const contactPersonWords = entry.contactPerson
              ? entry.contactPerson.toLowerCase().split(" ")
              : [];
            const keywordsWords = entry.keywords
              ? entry.keywords.toLowerCase().split(" ")
              : [];

            if (templateNameWords.includes(tagWord)) {
              matches += highPrio * 2;
            } else if (templateName.includes(tagWord)) {
              matches += highPrio;
            }

            if (contactWords.includes(tagWord)) {
              matches += highPrio * 2;
            } else if (entry.contact?.toLowerCase().includes(tagWord)) {
              matches += highPrio;
            }

            if (projectWords.includes(tagWord)) {
              matches += lowPrio * 2;
            } else if (entry.project?.toLowerCase().includes(tagWord)) {
              matches += lowPrio;
            }

            if (packageWords.includes(tagWord)) {
              matches += lowPrio * 2;
            } else if (entry.package?.toLowerCase().includes(tagWord)) {
              matches += lowPrio;
            }

            if (contactPersonWords.includes(tagWord)) {
              matches += mediumPrio * 2;
            } else if (entry.contactPerson?.toLowerCase().includes(tagWord)) {
              matches += mediumPrio;
            }

            if (keywordsWords.includes(tagWord)) {
              matches += mediumPrio * 2;
            } else if (entry.keywords?.toLowerCase().includes(tagWord)) {
              matches += mediumPrio;
            }

            const countIncrease = matches;

            // Add points to the pointsByTemplateId object
            if (countIncrease > 0) {
              // Create entry if it doesn't exist
              if (!pointsByTemplateId[entry.id]) {
                pointsByTemplateId[entry.id] = {
                  name: getTemplateName(entry),
                  total: 0,
                  points: {},
                };
              }
              // Create points entry if it doesn't exist
              if (!pointsByTemplateId[entry.id]["points"][tagWord]) {
                pointsByTemplateId[entry.id]["points"][tagWord] = countIncrease;
              } else {
                pointsByTemplateId[entry.id]["points"][tagWord] +=
                  countIncrease;
              }
            }
          });
        });
    });

    // Bail out if we have no matches
    if (Object.values(pointsByTemplateId).length === 0) {
      console.log("No matches found!");
      console.groupEnd();
      return;
    }

    // Count up the total points for every template within the pointsByTemplateId object
    Object.keys(pointsByTemplateId).map((templateId) => {
      pointsByTemplateId[templateId]["total"] = Object.values(
        pointsByTemplateId[templateId]["points"]
      ).reduce((a, b) => a + b);
    });

    // Sort the templates by highest total points.
    // Note: this is kept as an array of [id, data] pairs on purpose - re-inserting
    // into an object would let integer-like keys (legacy templates whose id is their
    // name) jump to the front and silently undo the sort.
    const sortedPointsByTemplateId = Object.entries(pointsByTemplateId).sort(
      ([, a], [, b]) => b.total - a.total
    );

    // Get the key(template id) of the sortedPointsByTemplateId which has the highest total points
    const [topTemplateId, topTemplateValues] = sortedPointsByTemplateId[0];

    const topTemplateEntry = templateEntries.find(
      (entry) => entry.id === topTemplateId
    );
    if (!topTemplateEntry) {
      console.log("Template not found!");
      console.groupEnd();
      return;
    }
    const templateName = getTemplateName(topTemplateEntry);

    // Check if there is only 1 highest total points, otherwise we do not auto map and leave the decision to the user
    const highestTotalPoints = topTemplateValues.total;
    const highestTotalPointsCount = sortedPointsByTemplateId.filter(
      ([, templateData]) => templateData.total === highestTotalPoints
    ).length;

    if (highestTotalPointsCount === 1) {
      // We have a winner! Assign the template id to the row
      importTemplateAssignment[rowIndex] = topTemplateId;
      console.log(
        "Auto mapping template: TemplateId: " + topTemplateId,
        "TemplateName: " + templateName
      );
    } else {
      // No clear winner, leave empty
      console.log("Auto mapping template: No clear winner!");
    }

    console.table(
      sortedPointsByTemplateId.map(([, templateData]) => ({
        TemplateName: templateData.name,
        TotalPoints: templateData.total,
        ...templateData.points,
      }))
    );

    console.groupEnd();
  });

  return importTemplateAssignment;
}
