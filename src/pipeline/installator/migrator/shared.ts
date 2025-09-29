export type NodeWithRange = {
  range: [number, number];
  raw?: string;
};

export function cleanQuotes(str: string): string {
  return str.replace(/^["']|["']$/g, "");
}

export function createSourceWrapper(config: string): string {
  return `return ${config}`;
}

export function extractFieldValue(field: any, source: string): string {
  const range = (field.value as unknown as NodeWithRange).range;
  return range ? source.substring(range[0], range[1]) : "{}";
}

export function extractFunctionBody(fieldValue: any, source: string): string {
  if (fieldValue.type === "FunctionDeclaration") {
    const funcNode = fieldValue as any;
    if (funcNode.body && funcNode.body.length > 0) {
      const bodyStatements = funcNode.body.map((stmt: NodeWithRange) => {
        if (stmt.range) {
          return source.substring(stmt.range[0], stmt.range[1]);
        }
        return "";
      }).filter(Boolean);
      return bodyStatements.join("\n");
    }
    return "";
  }
  return extractFieldValue({ value: fieldValue }, source);
}