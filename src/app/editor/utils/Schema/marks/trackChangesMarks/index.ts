import insertionMark from "./insertionMark";
import deletionMark from "./deletionMark";
import formatChangeMark from "./formatChangeMark";

export const trackChangesMarks =  {
  format_change: formatChangeMark,
  insertion: insertionMark,
  deletion: deletionMark
};
