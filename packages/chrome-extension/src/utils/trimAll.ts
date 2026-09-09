function trimAll(str: string) {
  if (str !== undefined && str.length > 0) {
    return str.replace(/\s+/g, "");
  }
  return "";
}

export default trimAll;
