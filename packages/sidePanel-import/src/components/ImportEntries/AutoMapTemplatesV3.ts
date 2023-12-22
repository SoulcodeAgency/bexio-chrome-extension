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
    const tagColumnsContent = tagColumnIndexes.map((index) => row[index]);
    const pointsByTemplateName: {
      [key: string]: {
        id: string;
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
            const templateNameWords = entry.templateName
              .toLowerCase()
              .split(" ");
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
            } else if (entry.templateName.toLowerCase().includes(tagWord)) {
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

            // Add points to the pointsByTemplateName object
            if (countIncrease > 0) {
              // Create entry if it doesn't exist
              if (!pointsByTemplateName[entry.templateName]) {
                pointsByTemplateName[entry.templateName] = {
                  id: entry.id,
                  total: 0,
                  points: {},
                };
              }
              // Create points entry if it doesn't exist
              if (
                !pointsByTemplateName[entry.templateName]["points"][tagWord]
              ) {
                pointsByTemplateName[entry.templateName]["points"][tagWord] =
                  countIncrease;
              } else {
                pointsByTemplateName[entry.templateName]["points"][tagWord] +=
                  countIncrease;
              }
            }
          });
        });
    });

    // Count up the total points for every template within the pointsByTemplateName object
    Object.keys(pointsByTemplateName).map((templateName) => {
      pointsByTemplateName[templateName]["total"] = Object.values(
        pointsByTemplateName[templateName]["points"]
      ).reduce((a, b) => a + b);
    });

    // Sort the pointsByTemplateName object by highest total points
    const sortedPointsByTemplateName: typeof pointsByTemplateName = {};
    Object.keys(pointsByTemplateName)
      .sort(
        (a, b) =>
          pointsByTemplateName[b]["total"] - pointsByTemplateName[a]["total"]
      )
      .forEach((key) => {
        sortedPointsByTemplateName[key] = pointsByTemplateName[key];
      });

    // Get the key(template id) of the sortedPointsByTemplateName which has the highest total points
    const [topTemplateKeyName, topTemplateValues] = Object.entries(
      sortedPointsByTemplateName
    )[0];
    const topTemplateId = topTemplateValues.id;
    const templateName = getTemplateName(
      templateEntries.find((entry) => entry.id === topTemplateId)!
    );

    // Check if there is only 1 highest total points, otherwise we do not auto map and leave the decision to the user
    const highestTotalPoints =
      sortedPointsByTemplateName[topTemplateKeyName].total;
    const highestTotalPointsCount = Object.values(
      sortedPointsByTemplateName
    ).filter(
      (templateData) => templateData.total === highestTotalPoints
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
      Object.entries(sortedPointsByTemplateName).map(
        ([templateName, templateData]) => ({
          TemplateName: templateName,
          TotalPoints: templateData.total,
          ...templateData.points,
        })
      )
    );

    console.groupEnd();
  });

  return importTemplateAssignment;
}
