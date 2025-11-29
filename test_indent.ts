import { ParserState } from './src/parser/state';

const state = new ParserState("   * - ..\n     - Head 1\n     - Head 2\n\n   * - Row 1");
console.log("Line 0:", `"${state.peekLine(0)}"`, "trim:", `"${state.peekLine(0)?.trim()}"`, "indent:", state.getIndentation(state.peekLine(0) || ""));
console.log("Line 1:", `"${state.peekLine(1)}"`, "trim:", `"${state.peekLine(1)?.trim()}"`, "indent:", state.getIndentation(state.peekLine(1) || ""));
console.log("Line 2:", `"${state.peekLine(2)}"`, "trim:", `"${state.peekLine(2)?.trim()}"`, "indent:", state.getIndentation(state.peekLine(2) || ""));
console.log("Line 3:", `"${state.peekLine(3)}"`, "trim:", `"${state.peekLine(3)?.trim()}"`, "indent:", state.getIndentation(state.peekLine(3) || ""));
console.log("Line 4:", `"${state.peekLine(4)}"`, "trim:", `"${state.peekLine(4)?.trim()}"`, "indent:", state.getIndentation(state.peekLine(4) || ""));
