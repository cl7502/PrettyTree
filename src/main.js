import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
const TRANSLATIONS = {
    en: {
        title: "BeautifyWeb",
        input: "INPUT",
        preview: "PREVIEW",
        structure: "STRUCTURE VISUALIZATION",
        codeView: "CODE VIEW",
        editOutput: "EDIT OUTPUT",
        editMode: "Edit Mode",
        doneEditing: "Done Editing",
        structureGraph: "Structure Graph",
        codeViewBtn: "Code View",
        refreshGraph: "Refresh Graph",
        copy: "Copy",
        searchPlaceholder: "Search...",
        options: "Options",
        indentation: "Indentation",
        general: "General",
        xmlHtml: "XML / HTML",
        preserveNewlines: "Preserve newlines",
        spaceAnon: "Space before anonymous function",
        keepArrayIndent: "Keep array indentation",
        sortAttrs: "Sort attributes",
        spaceSlash: "Add space before self-closing />",
        copied: "Copied to clipboard!",
        failedCopy: "Failed to copy",
        fitView: "Fit View",
        graphError: "Graph view not supported for this content yet.",
        spaces2: "2 spaces",
        spaces4: "4 spaces",
        spaces8: "8 spaces",
        langEn: "English",
        langZh: "中文",
        nodeValueCopied: "Node Value copied!",
        nodeKeyCopied: "Node Key copied!",
        graphCopyMode: "Graph Double-click Copy",
        copyValue: "Value (Default)",
        copyKey: "Key / Label",
    },
    zh: {
        title: "BeautifyWeb",
        input: "输入",
        preview: "预览",
        structure: "结构可视化",
        codeView: "代码视图",
        editOutput: "编辑输出",
        editMode: "编辑模式",
        doneEditing: "完成编辑",
        structureGraph: "结构图",
        codeViewBtn: "代码视图",
        refreshGraph: "刷新图表",
        copy: "复制",
        searchPlaceholder: "搜索...",
        options: "设置",
        indentation: "缩进",
        general: "常规",
        xmlHtml: "XML / HTML",
        preserveNewlines: "保留换行符",
        spaceAnon: "匿名函数前加空格",
        keepArrayIndent: "保持数组缩进",
        sortAttrs: "属性排序",
        spaceSlash: "自闭合标签 /> 前加空格",
        copied: "已复制到剪贴板！",
        failedCopy: "复制失败",
        fitView: "适应视图",
        graphError: "暂不支持此内容的图形化展示。",
        spaces2: "2 空格",
        spaces4: "4 空格",
        spaces8: "8 空格",
        langEn: "English",
        langZh: "中文",
        nodeValueCopied: "节点值(Value)已复制！",
        nodeKeyCopied: "节点键(Key)已复制！",
        graphCopyMode: "图形节点双击复制",
        copyValue: "值 (Value) - 默认",
        copyKey: "键 (Key) / 标签",
    },
};
// --- 1. UTILITIES & PARSING ENGINE ---
const detectLanguage = (content) => {
    const trimmed = content.trim();
    if (!trimmed)
        return "text";
    if ((trimmed.startsWith("{") || trimmed.startsWith("[")) &&
        (trimmed.endsWith("}") || trimmed.endsWith("]")))
        return "json";
    if (trimmed.startsWith("<"))
        return "xml"; // Covers HTML
    if (trimmed.includes("{") && trimmed.includes(":") && trimmed.includes(";"))
        return "css";
    return "javascript";
};
// Basic formatters
const formatJSON = (content, options) => {
    const indentSize = options.indent_size || 4;
    try {
        const parsed = JSON.parse(content);
        return JSON.stringify(parsed, null, indentSize);
    }
    catch (e) {
        return content;
    }
};
// Enhanced CSS Parser
const parseCSSTree = (css) => {
    const root = { rules: [], type: "root" };
    // Remove comments
    const cleanCss = css.replace(/\/\*[\s\S]*?\*\//g, "");
    // Split by closing brace '}' to get Rule Blocks
    const blocks = cleanCss.split("}");
    let count = 0;
    blocks.forEach((block) => {
        if (!block.trim())
            return;
        const parts = block.split("{");
        if (parts.length < 2)
            return; // Invalid
        const selector = parts[0].trim();
        const body = parts[1].trim();
        const props = [];
        // Split properties by ';'
        // Handle base64 data URIs which might contain ';' inside url(...) - simplified check
        let buffer = "";
        for (let i = 0; i < body.length; i++) {
            if (body[i] === ";") {
                if (buffer.trim()) {
                    const colonIdx = buffer.indexOf(":");
                    if (colonIdx > 0) {
                        props.push({
                            prop: buffer.substring(0, colonIdx).trim(),
                            val: buffer.substring(colonIdx + 1).trim(),
                        });
                    }
                }
                buffer = "";
            }
            else {
                buffer += body[i];
            }
        }
        // Flush buffer
        if (buffer.trim()) {
            const colonIdx = buffer.indexOf(":");
            if (colonIdx > 0) {
                props.push({
                    prop: buffer.substring(0, colonIdx).trim(),
                    val: buffer.substring(colonIdx + 1).trim(),
                });
            }
        }
        if (selector) {
            root.rules.push({
                id: `css-${count++}`,
                selector,
                properties: props,
                type: "rule",
            });
        }
    });
    return root;
};
const formatCSS = (css, options) => {
    const indentSize = options.indent_size || 4;
    const indent = " ".repeat(indentSize);
    let result = "";
    let depth = 0;
    const clean = css.replace(/\s+/g, " ");
    for (let i = 0; i < clean.length; i++) {
        const char = clean[i];
        if (char === "{") {
            result += " {\n" + indent.repeat(++depth);
        }
        else if (char === "}") {
            result += "\n" + indent.repeat(--depth) + "}";
        }
        else if (char === ";") {
            result += ";\n" + indent.repeat(depth);
        }
        else {
            result += char;
        }
    }
    return result;
};
// HTML Void Elements that don't require closing tags
const VOID_TAGS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);
const tokenizeXML = (source) => {
    const tokens = [];
    let pos = 0;
    const len = source.length;
    while (pos < len) {
        const lt = source.indexOf("<", pos);
        if (lt === -1) {
            const text = source.slice(pos).trim();
            if (text)
                tokens.push({ type: "text", content: text });
            break;
        }
        if (lt > pos) {
            const text = source.slice(pos, lt).trim();
            if (text)
                tokens.push({ type: "text", content: text });
        }
        const char1 = source[lt + 1];
        const char2 = source[lt + 2];
        if (char1 === "!" && char2 === "-") {
            const end = source.indexOf("-->", lt);
            const endIndex = end !== -1 ? end + 3 : len;
            tokens.push({ type: "comment", content: source.slice(lt, endIndex) });
            pos = endIndex;
            continue;
        }
        if (char1 === "!" && source.substr(lt, 9) === "<![CDATA[") {
            const end = source.indexOf("]]>", lt);
            const endIndex = end !== -1 ? end + 3 : len;
            tokens.push({ type: "cdata", content: source.slice(lt, endIndex) });
            pos = endIndex;
            continue;
        }
        if (char1 === "?") {
            const end = source.indexOf("?>", lt);
            const endIndex = end !== -1 ? end + 2 : len;
            tokens.push({ type: "pi", content: source.slice(lt, endIndex) });
            pos = endIndex;
            continue;
        }
        if (char1 === "!") {
            let end = source.indexOf(">", lt);
            if (end === -1)
                end = len;
            else
                end += 1;
            tokens.push({ type: "doctype", content: source.slice(lt, end) });
            pos = end;
            continue;
        }
        if (char1 === "/") {
            const end = source.indexOf(">", lt);
            const endIndex = end !== -1 ? end + 1 : len;
            const content = source.slice(lt, endIndex);
            const nameMatch = content.match(/^<\/\s*([^\s>]+)/);
            tokens.push({
                type: "close",
                content,
                name: nameMatch ? nameMatch[1] : "",
            });
            pos = endIndex;
            continue;
        }
        let end = -1;
        let inQuote = null;
        for (let i = lt + 1; i < len; i++) {
            const c = source[i];
            if (inQuote) {
                if (c === inQuote)
                    inQuote = null;
            }
            else {
                if (c === '"' || c === "'")
                    inQuote = c;
                else if (c === ">") {
                    end = i;
                    break;
                }
            }
        }
        if (end === -1) {
            tokens.push({ type: "text", content: source.slice(lt) });
            pos = len;
        }
        else {
            const raw = source.slice(lt, end + 1);
            const isSelf = /\/\s*>$/.test(raw);
            const nameMatch = raw.match(/^<\s*([^\s/>]+)/);
            const name = nameMatch ? nameMatch[1] : "unknown";
            let attrStr = "";
            if (nameMatch) {
                const contentStart = nameMatch[0].length;
                const contentEnd = isSelf ? raw.lastIndexOf("/") : raw.length - 1;
                if (contentEnd > contentStart) {
                    attrStr = raw.slice(contentStart, contentEnd);
                }
            }
            tokens.push({
                type: isSelf ? "self" : "open",
                content: raw,
                name,
                attrs: attrStr,
            });
            pos = end + 1;
        }
    }
    return tokens;
};
const parseAttributes = (attrStr) => {
    const attrs = {};
    const attrRegex = /([a-zA-Z0-9_\-:\.]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
        attrs[m[1]] = m[2] || m[3] || m[4] || "";
    }
    return attrs;
};
const parseXMLTree = (xml) => {
    const tokens = tokenizeXML(xml);
    const root = {
        id: "ROOT",
        tag: "ROOT",
        attrs: {},
        children: [],
        type: "root",
    };
    const stack = [root];
    let nodeCount = 0;
    tokens.forEach((t) => {
        const parent = stack[stack.length - 1];
        const nodeId = `node-${nodeCount++}`;
        if (t.type === "open") {
            const isVoid = VOID_TAGS.has(t.name?.toLowerCase() || "");
            const node = {
                id: nodeId,
                tag: t.name || "unknown",
                attrs: parseAttributes(t.attrs || ""),
                children: [],
                type: "element",
            };
            parent.children.push(node);
            if (!isVoid) {
                stack.push(node);
            }
        }
        else if (t.type === "close") {
            if (stack.length > 1 && stack[stack.length - 1].tag === t.name) {
                // Special handling for STYLE tags: Parse content as CSS
                const closedNode = stack[stack.length - 1];
                if (closedNode.tag.toLowerCase() === "style") {
                    // Combine text children
                    const textContent = closedNode.children
                        .filter((c) => typeof c === "string")
                        .join("");
                    // Parse CSS
                    const cssRoot = parseCSSTree(textContent);
                    // Convert CSS Root to XmlTreeNodes
                    const cssNodes = cssRoot.rules.map((r, rIdx) => ({
                        id: `${closedNode.id}-rule-${rIdx}`,
                        tag: r.selector,
                        type: "css-rule",
                        attrs: {},
                        children: r.properties.map((p, pIdx) => ({
                            id: `${closedNode.id}-rule-${rIdx}-p-${pIdx}`,
                            tag: p.prop,
                            type: "css-prop",
                            attrs: {},
                            children: [],
                            cssVal: p.val,
                        })),
                    }));
                    // Replace children
                    closedNode.children = cssNodes;
                }
                stack.pop();
            }
        }
        else if (t.type === "self") {
            const node = {
                id: nodeId,
                tag: t.name || "unknown",
                attrs: parseAttributes(t.attrs || ""),
                children: [],
                type: "element",
            };
            parent.children.push(node);
        }
        else if (t.type === "text" || t.type === "cdata") {
            const txt = t.content.trim();
            if (txt)
                parent.children.push(t.content); // Keep whitespace for code view? Or trim?
        }
        else if (t.type === "comment") {
            // Optional: include comments
        }
    });
    return root;
};
const processAttributesString = (attrStr, sort) => {
    if (!attrStr || !attrStr.trim())
        return "";
    const attrs = [];
    const attrRegex = /([a-zA-Z0-9_\-:\.]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let m;
    while ((m = attrRegex.exec(attrStr)) !== null) {
        attrs.push({ key: m[1], full: m[0] });
    }
    if (sort)
        attrs.sort((a, b) => a.key.toLowerCase().localeCompare(b.key.toLowerCase()));
    return " " + attrs.map((a) => a.full).join(" ");
};
const formatXML = (xml, options) => {
    const indentSize = options.indent_size || 4;
    const sortAttrs = options.xml_sort_attributes || false;
    const spaceSlash = options.xml_space_before_slash !== false;
    const indentChar = " ".repeat(indentSize);
    const tokens = tokenizeXML(xml);
    let result = "";
    let depth = 0;
    for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        const next = tokens[i + 1];
        const next2 = tokens[i + 2];
        const addLine = (content, d) => {
            result += "\n" + indentChar.repeat(d) + content;
        };
        if (t.type === "open") {
            let attrs = processAttributesString(t.attrs || "", sortAttrs);
            const openTag = `<${t.name}${attrs}>`;
            const isVoid = VOID_TAGS.has(t.name?.toLowerCase() || "");
            if (isVoid) {
                addLine(openTag, depth);
            }
            else if (next &&
                next.type === "text" &&
                next2 &&
                next2.type === "close" &&
                next2.name === t.name &&
                next.content.length < 60) {
                addLine(`${openTag}${next.content}${next2.content}`, depth);
                i += 2;
            }
            else if (next && next.type === "close" && next.name === t.name) {
                addLine(`${openTag}${next.content}`, depth);
                i += 1;
            }
            else {
                addLine(openTag, depth);
                depth++;
            }
        }
        else if (t.type === "close") {
            const isVoid = VOID_TAGS.has(t.name?.toLowerCase() || "");
            if (!isVoid) {
                depth = Math.max(0, depth - 1);
                addLine(t.content, depth);
            }
        }
        else if (t.type === "self") {
            let attrs = processAttributesString(t.attrs || "", sortAttrs);
            const suffix = spaceSlash ? " />" : "/>";
            addLine(`<${t.name}${attrs}${suffix}`, depth);
        }
        else if (["comment", "cdata", "pi", "doctype"].includes(t.type)) {
            addLine(t.content, depth);
        }
        else if (t.type === "text") {
            addLine(t.content, depth);
        }
    }
    return result.trim();
};
const formatJS = (js, options) => {
    const indentSize = options.indent_size || 4;
    const spaceBeforeAnon = options.space_before_anon_func || false;
    const indent = " ".repeat(indentSize);
    let source = js;
    if (spaceBeforeAnon) {
        source = source.replace(/function\s*\(/g, "function (");
    }
    else {
        source = source.replace(/function\s+\(/g, "function(");
    }
    let result = "";
    let depth = 0;
    let inString = false;
    let strChar = "";
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if ((char === '"' || char === "'") && source[i - 1] !== "\\") {
            if (!inString) {
                inString = true;
                strChar = char;
            }
            else if (char === strChar) {
                inString = false;
            }
        }
        if (!inString) {
            if (char === "{" || char === "[") {
                result += char + "\n" + indent.repeat(++depth);
                continue;
            }
            else if (char === "}" || char === "]") {
                depth = Math.max(0, depth - 1);
                result += "\n" + indent.repeat(depth) + char;
                continue;
            }
            else if (char === ";") {
                result += char + "\n" + indent.repeat(depth);
                continue;
            }
            else if (char === ",") {
                result += char + "\n" + indent.repeat(depth);
                continue;
            }
        }
        result += char;
    }
    return result.replace(/^\s*\n/gm, "");
};
const beautify = (content, lang, options) => {
    if (!content.trim())
        return "";
    try {
        if (lang === "json")
            return formatJSON(content, options);
        if (lang === "xml")
            return formatXML(content, options);
        if (lang === "css")
            return formatCSS(content, options);
        if (lang === "javascript")
            return formatJS(content, options);
        return content;
    }
    catch (e) {
        return content;
    }
};
const ROW_HEIGHT = 30;
const CHAR_W = 8;
const NODE_PAD_X = 20;
const LEVEL_GAP = 80;
const ID_SEP = "|";
const measureText = (str) => {
    return Math.max(80, str.length * CHAR_W + NODE_PAD_X * 2);
};
// JSON Graph Builder
const buildJsonGraph = (data, key = "ROOT", id = "ROOT") => {
    const isArr = Array.isArray(data);
    const isObj = typeof data === "object" && data !== null;
    const node = {
        id,
        label: key,
        type: isArr ? "array" : isObj ? "object" : "value",
        value: !isObj && data !== undefined && data !== null ? String(data) : undefined,
        x: 0,
        y: 0,
        width: 0,
        height: ROW_HEIGHT,
        children: [],
    };
    let displayLabel = key;
    if (node.value !== undefined) {
        const valStr = String(node.value);
        displayLabel = `${key}: ${valStr.length > 20 ? valStr.substring(0, 20) + "..." : valStr}`;
    }
    node.width = measureText(displayLabel);
    if (isObj) {
        Object.keys(data).forEach((k, idx) => {
            const childKey = isArr ? idx.toString() : k;
            const uniqueKey = isArr ? idx.toString() : k;
            const childID = id + ID_SEP + uniqueKey;
            node.children.push(buildJsonGraph(data[k], isArr ? idx.toString() : k, childID));
        });
    }
    return node;
};
// XML Graph Builder (Handles CSS Rules too)
const buildXmlGraph = (tree, path = "ROOT") => {
    const node = {
        id: path,
        label: tree.tag,
        type: "object",
        x: 0,
        y: 0,
        width: 0,
        height: ROW_HEIGHT,
        children: [],
    };
    // If CSS Rule Node
    if (tree.type === "css-rule") {
        // Children are props
        tree.children.forEach((child, idx) => {
            if (typeof child !== "string" && child.type === "css-prop") {
                node.children.push({
                    id: path + ID_SEP + "prop-" + idx,
                    label: child.tag,
                    value: child.cssVal,
                    type: "value",
                    x: 0,
                    y: 0,
                    width: measureText(child.tag + ": " + child.cssVal),
                    height: ROW_HEIGHT,
                    children: [],
                });
            }
        });
        node.width = measureText(tree.tag);
        return node;
    }
    // Normal XML Node
    const attrKeys = Object.keys(tree.attrs);
    let labelText = tree.tag;
    if (attrKeys.length > 0) {
        attrKeys.forEach((k, idx) => {
            node.children.push({
                id: path + ID_SEP + "@" + k,
                label: "@" + k,
                value: tree.attrs[k],
                type: "value",
                x: 0,
                y: 0,
                width: measureText("@" + k + ": " + tree.attrs[k]),
                height: ROW_HEIGHT,
                children: [],
            });
        });
    }
    tree.children.forEach((child, idx) => {
        if (typeof child === "string") {
            const val = child.trim();
            if (val) {
                node.children.push({
                    id: path + ID_SEP + "txt" + idx,
                    label: "#text",
                    value: val.length > 20 ? val.substring(0, 20) + "..." : val,
                    type: "value",
                    x: 0,
                    y: 0,
                    width: measureText("#text: " + val),
                    height: ROW_HEIGHT,
                    children: [],
                });
            }
        }
        else {
            node.children.push(buildXmlGraph(child, path + ID_SEP + child.tag + idx));
        }
    });
    node.width = measureText(labelText);
    return node;
};
// CSS Graph Builder
const buildCssGraph = (tree, path = "ROOT") => {
    const node = {
        id: path,
        label: "StyleSheet",
        type: "object",
        x: 0,
        y: 0,
        width: 100,
        height: ROW_HEIGHT,
        children: [],
    };
    tree.rules.forEach((rule, idx) => {
        const ruleNode = {
            id: path + ID_SEP + "rule" + idx,
            label: rule.selector,
            type: "object",
            x: 0,
            y: 0,
            width: measureText(rule.selector),
            height: ROW_HEIGHT,
            children: [],
        };
        rule.properties.forEach((p, pIdx) => {
            ruleNode.children.push({
                id: path + ID_SEP + "rule" + idx + ID_SEP + p.prop,
                label: p.prop,
                value: p.val,
                type: "value",
                x: 0,
                y: 0,
                width: measureText(p.prop + ": " + p.val),
                height: ROW_HEIGHT,
                children: [],
            });
        });
        node.children.push(ruleNode);
    });
    return node;
};
// Unified Graph Builder
const buildGraphDataGeneric = (content, lang) => {
    if (lang === "json") {
        try {
            const data = JSON.parse(content);
            return buildJsonGraph(data);
        }
        catch (e) {
            return null;
        }
    }
    else if (lang === "xml") {
        try {
            const tree = parseXMLTree(content);
            return buildXmlGraph(tree);
        }
        catch (e) {
            return null;
        }
    }
    else if (lang === "css") {
        try {
            const tree = parseCSSTree(content);
            return buildCssGraph(tree);
        }
        catch (e) {
            return null;
        }
    }
    return null;
};
// Update Layout to respect collapsed nodes
const layoutGraph = (root, collapsedIds) => {
    const calcSize = (n) => {
        let h = 0;
        // If collapsed, ignore children size
        if (collapsedIds.has(n.id) || n.children.length === 0) {
            h = ROW_HEIGHT + 10;
        }
        else {
            n.children.forEach((c) => (h += calcSize(c)));
        }
        n._subtreeHeight = h;
        return h;
    };
    const visibleNodes = [];
    const assignPos = (n, x, y) => {
        n.x = x;
        n.y = y + n._subtreeHeight / 2 - ROW_HEIGHT / 2;
        visibleNodes.push(n);
        // If collapsed, stop recursion
        if (collapsedIds.has(n.id))
            return;
        let curY = y;
        const nextX = x + n.width + LEVEL_GAP;
        n.children.forEach((c) => {
            assignPos(c, nextX, curY);
            curY += c._subtreeHeight;
        });
    };
    calcSize(root);
    assignPos(root, 50, 50);
    return visibleNodes;
};
const GraphViewer = ({ data, lang, onResetRef, selectedId, onSelect, t, onCopy, copyMode, }) => {
    const [nodes, setNodes] = useState([]);
    const [rootNode, setRootNode] = useState(null);
    const [transform, setTransform] = useState({ x: 20, y: 20, k: 1 });
    const [dragging, setDragging] = useState(null);
    const [panning, setPanning] = useState(null);
    const svgRef = useRef(null);
    const lastCenteredId = useRef(null);
    const [collapsedIds, setCollapsedIds] = useState(new Set());
    // Ref to prevent auto-centering on manual interaction
    const ignoreCenterRef = useRef(false);
    // 1. Build Graph Tree
    useEffect(() => {
        if (!data) {
            setRootNode(null);
            return;
        }
        const root = buildGraphDataGeneric(data, lang);
        setRootNode(root);
        setCollapsedIds(new Set()); // Reset collapse on data change
    }, [data, lang]);
    // 2. Layout & Visible Nodes
    useEffect(() => {
        if (!rootNode) {
            setNodes([]);
            return;
        }
        const visible = layoutGraph(rootNode, collapsedIds);
        setNodes([...visible]); // spread to force update
    }, [rootNode, collapsedIds]);
    // Auto Center
    useEffect(() => {
        if (!selectedId || nodes.length === 0 || !svgRef.current)
            return;
        if (selectedId === lastCenteredId.current)
            return;
        // If user manually clicked a node in graph, ignore this centering update
        if (ignoreCenterRef.current) {
            ignoreCenterRef.current = false;
            lastCenteredId.current = selectedId; // Mark as seen so we don't center later unexpectedly
            return;
        }
        const node = nodes.find((n) => n.id === selectedId);
        if (node) {
            setTransform((prev) => {
                const w = svgRef.current?.clientWidth || 800;
                const h = svgRef.current?.clientHeight || 600;
                const k = prev.k;
                const nodeCenterX = node.x + node.width / 2;
                const nodeCenterY = node.y + ROW_HEIGHT / 2;
                return { k, x: w / 2 - nodeCenterX * k, y: h / 2 - nodeCenterY * k };
            });
            lastCenteredId.current = selectedId;
        }
    }, [selectedId, nodes]);
    const fitView = useCallback(() => {
        if (nodes.length === 0 || !svgRef.current)
            return;
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        nodes.forEach((n) => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
        });
        const w = svgRef.current.clientWidth;
        const h = svgRef.current.clientHeight;
        const contentW = maxX - minX || 100;
        const contentH = maxY - minY || 100;
        const scale = Math.min((w - 100) / contentW, (h - 100) / contentH, 1);
        setTransform({
            x: (w - contentW * scale) / 2 - minX * scale,
            y: (h - contentH * scale) / 2 - minY * scale,
            k: scale,
        });
    }, [nodes]);
    useEffect(() => {
        if (onResetRef)
            onResetRef.current = fitView;
    }, [onResetRef, fitView]);
    const handleMouseDown = (e) => {
        if (e.button !== 0)
            return;
        const target = e.target;
        const nodeEl = target.closest(".node-group");
        // Dont trigger drag if clicked on collapse button
        const isCollapseBtn = target.closest(".collapse-btn");
        if (nodeEl && !isCollapseBtn) {
            const id = nodeEl.getAttribute("data-id");
            e.stopPropagation();
            // Flag to ignore the upcoming auto-center effect
            ignoreCenterRef.current = true;
            if (onSelect)
                onSelect(id);
            setDragging({ id, startX: e.clientX, startY: e.clientY });
        }
        else if (!isCollapseBtn) {
            setPanning({ startX: e.clientX, startY: e.clientY });
        }
    };
    const handleDoubleClick = (e) => {
        const target = e.target;
        const nodeEl = target.closest(".node-group");
        if (nodeEl) {
            const id = nodeEl.getAttribute("data-id");
            e.stopPropagation();
            const node = nodes.find((n) => n.id === id);
            if (node) {
                let copyText = "";
                let type = "value";
                if (copyMode === "key") {
                    copyText = node.label;
                    type = "key";
                }
                else {
                    // Default Value, fallback to label if no value exists (e.g. container node)
                    if (node.value !== undefined) {
                        copyText = node.value;
                        type = "value";
                    }
                    else {
                        copyText = node.label;
                        type = "key"; // Copied label because value didn't exist, effectively key
                    }
                }
                if (copyText && onCopy) {
                    onCopy(copyText, type);
                }
            }
        }
    };
    const handleMouseMove = (e) => {
        if (dragging) {
            const dx = (e.clientX - dragging.startX) / transform.k;
            const dy = (e.clientY - dragging.startY) / transform.k;
            setNodes((prev) => prev.map((n) => n.id === dragging.id ? { ...n, x: n.x + dx, y: n.y + dy } : n));
            setDragging({ ...dragging, startX: e.clientX, startY: e.clientY });
        }
        else if (panning) {
            setTransform((t) => ({
                ...t,
                x: t.x + (e.clientX - panning.startX),
                y: t.y + (e.clientY - panning.startY),
            }));
            setPanning({ startX: e.clientX, startY: e.clientY });
        }
    };
    const handleWheel = (e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const s = e.deltaY < 0 ? 1.1 : 0.9;
            setTransform((t) => ({ ...t, k: Math.max(0.1, Math.min(5, t.k * s)) }));
        }
        else {
            setTransform((t) => ({ ...t, x: t.x - e.deltaX, y: t.y - e.deltaY }));
        }
    };
    const handleMouseUp = () => {
        setDragging(null);
        setPanning(null);
    };
    const toggleCollapse = (e, id) => {
        e.stopPropagation();
        const newSet = new Set(collapsedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        }
        else {
            newSet.add(id);
        }
        setCollapsedIds(newSet);
    };
    const renderLinks = () => {
        return nodes.flatMap((parent) => {
            // If collapsed, dont draw children links
            if (collapsedIds.has(parent.id))
                return [];
            return parent.children
                .map((child) => {
                const currentChild = nodes.find((n) => n.id === child.id);
                // Parent is normally in nodes, but we use 'parent' iteration var which is correct from visibleNodes
                if (!currentChild)
                    return null;
                const sx = parent.x + parent.width;
                const sy = parent.y + ROW_HEIGHT / 2;
                const tx = currentChild.x;
                const ty = currentChild.y + ROW_HEIGHT / 2;
                const d = `M ${sx} ${sy} C ${sx + 50} ${sy}, ${tx - 50} ${ty}, ${tx} ${ty}`;
                return (_jsx("path", { d: d, stroke: "#555", strokeWidth: "2", fill: "none" }, `${parent.id}-${child.id}`));
            })
                .filter(Boolean);
        });
    };
    return (_jsxs("div", { className: "w-full h-full bg-[#1e1e1e] relative overflow-hidden cursor-grab active:cursor-grabbing", children: [_jsx("svg", { ref: svgRef, width: "100%", height: "100%", onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseUp, onWheel: handleWheel, onDoubleClick: handleDoubleClick, children: _jsxs("g", { transform: `translate(${transform.x}, ${transform.y}) scale(${transform.k})`, children: [renderLinks(), nodes.map((n) => {
                            const isSelected = n.id === selectedId;
                            const hasChildren = n.children && n.children.length > 0;
                            const isCollapsed = collapsedIds.has(n.id);
                            return (_jsxs("g", { className: "node-group cursor-pointer", "data-id": n.id, transform: `translate(${n.x}, ${n.y})`, children: [_jsx("rect", { width: n.width, height: ROW_HEIGHT, rx: "4", fill: n.type === "value" ? "#2d2d2d" : "#0d1117", stroke: isSelected
                                            ? "#ff9900"
                                            : n.type === "value"
                                                ? "#a6e22e"
                                                : "#58a6ff", strokeWidth: isSelected ? "3" : "1", filter: isSelected ? "drop-shadow(0 0 4px #ff9900)" : "" }), _jsxs("text", { x: "10", y: "20", fontSize: "12", fontFamily: "monospace", fill: "#c9d1d9", style: { pointerEvents: "none" }, children: [n.label, n.value && _jsxs("tspan", { fill: "#a5d6ff", children: [": \"", n.value, "\""] })] }), hasChildren && (_jsxs("g", { className: "collapse-btn hover:opacity-80", transform: `translate(${n.width}, ${ROW_HEIGHT / 2})`, onClick: (e) => toggleCollapse(e, n.id), style: { cursor: "pointer" }, children: [_jsx("circle", { r: "8", fill: "#444", stroke: "#777", strokeWidth: "1" }), _jsx("text", { x: "0", y: "3", textAnchor: "middle", fill: "white", fontSize: "10", fontWeight: "bold", style: { pointerEvents: "none" }, children: isCollapsed ? "+" : "-" })] }))] }, n.id));
                        })] }) }), _jsxs("div", { className: "absolute top-4 left-4 bg-[#333] p-2 rounded shadow flex gap-2 z-10", children: [_jsx("button", { onClick: fitView, className: "text-xs px-2 py-1 bg-[#444] text-white rounded hover:bg-[#555]", children: t.fitView }), _jsx("button", { onClick: () => setTransform((t) => ({ ...t, k: t.k * 1.2 })), className: "text-xs px-2 py-1 bg-[#444] text-white rounded hover:bg-[#555]", children: "+" }), _jsx("button", { onClick: () => setTransform((t) => ({ ...t, k: t.k * 0.8 })), className: "text-xs px-2 py-1 bg-[#444] text-white rounded hover:bg-[#555]", children: "-" })] })] }));
};
// --- 3. SEARCH LOGIC ---
const searchJSON = (data, term, path = "ROOT") => {
    let matches = [];
    if (!term)
        return matches;
    const termLower = term.toLowerCase();
    const parts = path.split(ID_SEP);
    const key = parts[parts.length - 1];
    if (path !== "ROOT" && key.toLowerCase().includes(termLower)) {
        matches.push(path);
    }
    else if (typeof data !== "object" || data === null) {
        if (String(data).toLowerCase().includes(termLower)) {
            matches.push(path);
        }
    }
    if (typeof data === "object" && data !== null) {
        Object.keys(data).forEach((k, idx) => {
            const isArr = Array.isArray(data);
            const childKey = isArr ? idx.toString() : k;
            const childPath = path + ID_SEP + childKey;
            matches = matches.concat(searchJSON(data[k], term, childPath));
        });
    }
    return matches;
};
const searchText = (content, term) => {
    if (!term || !content)
        return [];
    const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    const matches = [];
    let m;
    while ((m = regex.exec(content)) !== null) {
        matches.push({ start: m.index, end: m.index + term.length });
    }
    return matches;
};
// --- 4. CODE VIEW COMPONENTS ---
const JsonNode = ({ name, value, isLast, path, selectedId, onSelect, indentSize, }) => {
    const [collapsed, setCollapsed] = useState(false);
    const isObj = typeof value === "object" && value !== null;
    const isArr = Array.isArray(value);
    const ref = useRef(null);
    const currentPath = path;
    const isSelected = selectedId === currentPath;
    const toggle = (e) => {
        e.stopPropagation();
        setCollapsed(!collapsed);
    };
    const handleSelect = (e) => {
        e.stopPropagation();
        if (onSelect)
            onSelect(currentPath);
    };
    useEffect(() => {
        if (isSelected && ref.current) {
            ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    }, [isSelected]);
    useEffect(() => {
        if (selectedId &&
            selectedId.startsWith(currentPath) &&
            selectedId !== currentPath) {
            setCollapsed(false);
        }
    }, [selectedId, currentPath]);
    const paddingStyle = { paddingLeft: `${indentSize * 10}px` };
    if (!isObj) {
        let valCol = "#ce9178";
        if (typeof value === "number")
            valCol = "#b5cea8";
        if (typeof value === "boolean")
            valCol = "#569cd6";
        if (value === null)
            valCol = "#569cd6";
        return (_jsxs("div", { ref: ref, style: paddingStyle, className: `font-mono text-sm leading-5 hover:bg-[#2a2d2e] cursor-pointer transition-colors ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900] rounded-sm" : ""}`, onClick: handleSelect, children: [name && _jsxs("span", { style: { color: "#9cdcfe" }, children: [name, ": "] }), _jsx("span", { style: { color: valCol }, children: JSON.stringify(value) }), !isLast && _jsx("span", { className: "text-gray-400", children: "," })] }));
    }
    const keys = Object.keys(value);
    const open = isArr ? "[" : "{";
    const close = isArr ? "]" : "}";
    return (_jsxs("div", { style: paddingStyle, className: "font-mono text-sm leading-5", children: [_jsxs("div", { ref: ref, className: `flex items-center cursor-pointer hover:bg-[#2a2d2e] transition-colors ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900] rounded-sm" : ""}`, onClick: (e) => {
                    toggle(e);
                    handleSelect(e);
                }, children: [_jsx("span", { className: `inline-block w-3 mr-1 text-gray-500 transform transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`, children: "\u25BC" }), name && _jsxs("span", { style: { color: "#9cdcfe" }, children: [name, ": "] }), _jsx("span", { className: "text-gray-300", children: open }), collapsed && _jsx("span", { className: "text-gray-500 mx-2", children: "..." }), collapsed && (_jsxs("span", { className: "text-gray-300", children: [close, !isLast && ","] }))] }), !collapsed && (_jsxs(_Fragment, { children: [keys.map((k, i) => {
                        const childKey = isArr ? i.toString() : k;
                        const childPath = currentPath + ID_SEP + childKey;
                        return (_jsx(JsonNode, { name: isArr ? "" : k, value: value[k], isLast: i === keys.length - 1, path: childPath, selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }, childKey));
                    }), _jsxs("div", { style: paddingStyle, className: "text-gray-300", children: [close, !isLast && ","] })] }))] }));
};
const XmlNodeRenderer = ({ node, path, selectedId, onSelect, indentSize, }) => {
    const [collapsed, setCollapsed] = useState(false);
    const ref = useRef(null);
    const isSelected = selectedId === path;
    const toggle = (e) => {
        e.stopPropagation();
        setCollapsed(!collapsed);
    };
    const handleSelect = (e) => {
        e.stopPropagation();
        if (onSelect)
            onSelect(path);
    };
    useEffect(() => {
        if (isSelected && ref.current)
            ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }, [isSelected]);
    const paddingStyle = { paddingLeft: `${indentSize * 10}px` };
    // Handle CSS Nodes inside XML
    if (node.type === "css-rule") {
        return (_jsxs("div", { style: paddingStyle, children: [_jsxs("div", { ref: ref, className: `flex items-center cursor-pointer hover:bg-[#2a2d2e] ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900]" : ""}`, onClick: (e) => {
                        toggle(e);
                        handleSelect(e);
                    }, children: [_jsx("span", { className: `inline-block w-3 mr-1 text-gray-500 transform transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`, children: "\u25BC" }), _jsx("span", { className: "text-[#d7ba7d]", children: node.tag }), " ", _jsx("span", { className: "text-gray-400", children: "{" })] }), !collapsed &&
                    node.children.map((child, idx) => (_jsx(XmlNodeRenderer, { node: child, path: path + ID_SEP + "rulechild" + idx, selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }, idx))), !collapsed && _jsx("div", { className: "text-gray-400", children: "}" })] }));
    }
    if (node.type === "css-prop") {
        return (_jsxs("div", { ref: ref, style: paddingStyle, className: `hover:bg-[#2a2d2e] ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900]" : ""}`, onClick: handleSelect, children: [_jsx("span", { className: "text-[#9cdcfe]", children: node.tag }), ":", " ", _jsx("span", { className: "text-[#ce9178]", children: node.cssVal }), ";"] }));
    }
    if (node.type === "text") {
        if (!node.children[0])
            return null;
        return (_jsx("div", { ref: ref, style: paddingStyle, className: `font-mono text-sm text-gray-300 hover:bg-[#2a2d2e] ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900]" : ""}`, onClick: handleSelect, children: typeof node.children[0] === "string" ? node.children[0] : "" }));
    }
    const hasChildren = node.children && node.children.length > 0;
    const attrsStr = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${v}"`)
        .join("");
    return (_jsxs("div", { style: paddingStyle, className: "font-mono text-sm leading-5", children: [_jsxs("div", { ref: ref, className: `flex items-center cursor-pointer hover:bg-[#2a2d2e] ${isSelected ? "bg-[#37373d] ring-1 ring-[#ff9900]" : ""}`, onClick: (e) => {
                    toggle(e);
                    handleSelect(e);
                }, children: [hasChildren && (_jsx("span", { className: `inline-block w-3 mr-1 text-gray-500 transform transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`, children: "\u25BC" })), !hasChildren && _jsx("span", { className: "w-3 mr-1" }), _jsxs("span", { className: "text-blue-400", children: ["<", node.tag] }), _jsx("span", { className: "text-blue-300", children: attrsStr }), _jsx("span", { className: "text-blue-400", children: hasChildren ? ">" : " />" })] }), hasChildren && !collapsed && (_jsxs(_Fragment, { children: [node.children.map((child, idx) => typeof child === "string" ? (_jsx("div", { style: paddingStyle, className: "pl-4 text-gray-300", children: child }, idx)) : (_jsx(XmlNodeRenderer, { node: child, path: path + ID_SEP + child.tag + idx, selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }, idx))), _jsxs("div", { style: paddingStyle, className: "text-blue-400", children: ["</", node.tag, ">"] })] }))] }));
};
const CssNodeRenderer = ({ root, selectedId, onSelect, indentSize, }) => {
    return (_jsx("div", { className: "font-mono text-sm", children: root.rules.map((rule, idx) => {
            // eslint-disable-next-line react-hooks/rules-of-hooks
            const [collapsed, setCollapsed] = useState(false);
            const rulePath = `ROOT${ID_SEP}rule${idx}`;
            const isSelected = selectedId && selectedId.startsWith(rulePath);
            return (_jsxs("div", { className: "mb-2", children: [_jsxs("div", { className: "flex items-center cursor-pointer hover:bg-[#2a2d2e]", onClick: () => setCollapsed(!collapsed), children: [_jsx("span", { className: `inline-block w-3 mr-1 text-gray-500 transform transition-transform ${collapsed ? "-rotate-90" : "rotate-0"}`, children: "\u25BC" }), _jsx("span", { className: "text-[#d7ba7d]", children: rule.selector }), " ", _jsx("span", { className: "text-gray-400", children: "{" })] }), !collapsed &&
                        rule.properties.map((p, pIdx) => (_jsxs("div", { style: { paddingLeft: `${indentSize * 10}px` }, className: "hover:bg-[#2a2d2e]", children: [_jsx("span", { className: "text-[#9cdcfe]", children: p.prop }), ":", " ", _jsx("span", { className: "text-[#ce9178]", children: p.val }), ";"] }, pIdx))), _jsx("div", { className: "text-gray-400", children: "}" })] }, idx));
        }) }));
};
const CodeOutput = ({ content, lang, selectedId, onSelect, options, }) => {
    const indentSize = options.indent_size || 4;
    if (lang === "json") {
        try {
            const data = JSON.parse(content || "{}");
            return (_jsx("div", { className: "p-4 font-mono text-sm h-full overflow-auto", children: _jsx(JsonNode, { name: "ROOT", value: data, isLast: true, path: "ROOT", selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }) }));
        }
        catch (e) {
            return _jsx("pre", { className: "p-4 text-red-400", children: content });
        }
    }
    else if (lang === "xml") {
        try {
            const tree = parseXMLTree(content);
            return (_jsx("div", { className: "p-4 font-mono text-sm h-full overflow-auto", children: _jsx(XmlNodeRenderer, { node: tree, path: "ROOT", selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }) }));
        }
        catch (e) {
            return _jsx("pre", { className: "p-4 text-red-400", children: content });
        }
    }
    else if (lang === "css") {
        try {
            const tree = parseCSSTree(content);
            return (_jsx("div", { className: "p-4 font-mono text-sm h-full overflow-auto", children: _jsx(CssNodeRenderer, { root: tree, selectedId: selectedId, onSelect: onSelect, indentSize: indentSize }) }));
        }
        catch (e) {
            return _jsx("pre", { className: "p-4 text-red-400", children: content });
        }
    }
    return (_jsx("div", { className: "p-4 font-mono text-sm h-full overflow-auto", children: _jsx("pre", { className: "whitespace-pre-wrap text-[#d4d4d4]", children: content }) }));
};
// Text Editor
const Editor = forwardRef(({ value, onChange, readOnly, }, ref) => {
    return (_jsx("textarea", { ref: ref, className: "w-full h-full bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 outline-none resize-none border-none focus:bg-[#1e1e1e]", style: { whiteSpace: "pre", overflowX: "auto" }, value: value, onChange: (e) => onChange && onChange(e.target.value), readOnly: readOnly, spellCheck: false }));
});
// Settings Sidebar
const SettingsSidebar = ({ open, onClose, options, onOptionChange, t, }) => {
    if (!open)
        return null;
    const handleChange = (key, val) => {
        onOptionChange({ ...options, [key]: val });
    };
    return (_jsxs("div", { className: "fixed inset-y-0 right-0 w-80 bg-[#252526] shadow-2xl z-50 border-l border-[#3e3e42] p-5 overflow-y-auto transform transition-transform", children: [_jsxs("div", { className: "flex justify-between items-center mb-6", children: [_jsx("h2", { className: "text-lg font-semibold text-white", children: t.options }), _jsx("button", { onClick: onClose, className: "text-gray-400 hover:text-white text-xl", children: "\u00D7" })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: t.indentation }), _jsxs("select", { className: "w-full bg-[#3c3c3c] border border-[#555] text-white p-2 rounded", value: options.indent_size, onChange: (e) => handleChange("indent_size", parseInt(e.target.value)), children: [_jsx("option", { value: 2, children: t.spaces2 }), _jsx("option", { value: 4, children: t.spaces4 }), _jsx("option", { value: 8, children: t.spaces8 })] })] }), _jsx("div", { className: "h-px bg-[#3e3e42] my-4" }), _jsx("div", { className: "text-xs font-bold text-gray-500 mb-2 uppercase", children: t.general }), [
                        { k: "preserve_newlines", l: t.preserveNewlines },
                        { k: "space_before_anon_func", l: t.spaceAnon },
                        { k: "keep_array_indentation", l: t.keepArrayIndent },
                    ].map((opt) => (_jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", className: "mr-3 h-4 w-4 bg-[#3c3c3c] border-[#555]", checked: options[opt.k] || false, onChange: (e) => handleChange(opt.k, e.target.checked) }), _jsx("span", { className: "text-sm text-gray-300", children: opt.l })] }, opt.k))), _jsx("div", { className: "h-px bg-[#3e3e42] my-4" }), _jsx("div", { className: "text-xs font-bold text-gray-500 mb-2 uppercase", children: t.xmlHtml }), [
                        { k: "xml_sort_attributes", l: t.sortAttrs },
                        { k: "xml_space_before_slash", l: t.spaceSlash },
                    ].map((opt) => (_jsxs("div", { className: "flex items-center", children: [_jsx("input", { type: "checkbox", className: "mr-3 h-4 w-4 bg-[#3c3c3c] border-[#555]", 
                                // Explicit check for xml_sort_attributes which defaults to false
                                checked: opt.k === "xml_sort_attributes"
                                    ? !!options[opt.k]
                                    : options[opt.k] !== false, onChange: (e) => handleChange(opt.k, e.target.checked) }), _jsx("span", { className: "text-sm text-gray-300", children: opt.l })] }, opt.k))), _jsx("div", { className: "h-px bg-[#3e3e42] my-4" }), _jsx("div", { className: "text-xs font-bold text-gray-500 mb-2 uppercase", children: t.structureGraph }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm text-gray-400 mb-2", children: t.graphCopyMode }), _jsxs("select", { className: "w-full bg-[#3c3c3c] border border-[#555] text-white p-2 rounded", value: options.graph_copy_mode || "value", onChange: (e) => handleChange("graph_copy_mode", e.target.value), children: [_jsx("option", { value: "value", children: t.copyValue }), _jsx("option", { value: "key", children: t.copyKey })] })] })] })] }));
};
// --- 5. MAIN APP ---
const App = () => {
    // State
    const [input, setInput] = useState("");
    const [output, setOutput] = useState("");
    const [mode, setMode] = useState("preview");
    const [splitPos, setSplitPos] = useState(40); // Percentage
    const [lang, setLang] = useState("text");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [notification, setNotification] = useState("");
    const [uiLang, setUiLang] = useState("zh"); // Default to Chinese
    const t = TRANSLATIONS[uiLang];
    // Highlight State
    const [highlightedId, setHighlightedId] = useState(null);
    // Search State
    const [searchTerm, setSearchTerm] = useState("");
    const [searchMatches, setSearchMatches] = useState([]);
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
    // Refs
    const graphResetRef = useRef(null);
    const leftEditorRef = useRef(null);
    const rightEditorRef = useRef(null);
    // Options State
    const [options, setOptions] = useState({
        indent_size: 4,
        preserve_newlines: true,
        space_before_anon_func: false,
        keep_array_indentation: false,
        xml_sort_attributes: false, // Default disabled
        xml_space_before_slash: true,
        graph_copy_mode: "value", // Default to value
    });
    // Adjust split layout based on mode
    useEffect(() => {
        if (mode === "graph") {
            setSplitPos(14.28); // 1:6 ratio (approx 14.3%)
        }
        else {
            setSplitPos(40); // 4:6 ratio (40%)
        }
    }, [mode]);
    // Auto-detect and Beautify logic
    useEffect(() => {
        const detected = detectLanguage(input);
        setLang(detected);
        if (!input.trim()) {
            setOutput("");
            setHighlightedId(null);
            setSearchMatches([]);
            return;
        }
        const beautified = beautify(input, detected, options);
        setOutput(beautified);
        // Reset highlighting when content changes drastically
        setHighlightedId(null);
    }, [input, options]);
    // Search Logic Execution
    useEffect(() => {
        if (!searchTerm) {
            setSearchMatches([]);
            setCurrentMatchIndex(0);
            setHighlightedId(null);
            return;
        }
        let matches = [];
        // Priority: if JSON, use Structure Search (Nodes)
        if (lang === "json") {
            try {
                const jsonData = JSON.parse(output || "{}");
                const ids = searchJSON(jsonData, searchTerm, "ROOT");
                matches = ids.map((id) => ({ type: "node", id }));
            }
            catch (e) {
                // Fallback to text search if parse fails
                const textM = searchText(output, searchTerm);
                matches = textM.map((m) => ({ type: "text", ...m }));
            }
        }
        else {
            // Text Search for other languages
            const textM = searchText(output, searchTerm);
            matches = textM.map((m) => ({ type: "text", ...m }));
        }
        setSearchMatches(matches);
        setCurrentMatchIndex(0);
        // Automatically highlight first match
        if (matches.length > 0) {
            applyMatch(matches[0]);
        }
    }, [searchTerm, output, lang]);
    // Helper to apply match (Highlight node or select text)
    const applyMatch = (match) => {
        if (match.type === "node") {
            setHighlightedId(match.id);
        }
        else if (match.type === "text") {
            // Text highlighting
            // If mode is Edit, highlight in Right Editor
            if (mode === "edit" && rightEditorRef.current) {
                rightEditorRef.current.focus();
                rightEditorRef.current.setSelectionRange(match.start, match.end);
            }
        }
    };
    const nextMatch = () => {
        if (searchMatches.length === 0)
            return;
        const next = (currentMatchIndex + 1) % searchMatches.length;
        setCurrentMatchIndex(next);
        applyMatch(searchMatches[next]);
    };
    const prevMatch = () => {
        if (searchMatches.length === 0)
            return;
        const prev = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
        setCurrentMatchIndex(prev);
        applyMatch(searchMatches[prev]);
    };
    // Sync back from Editor Mode
    const handleOutputEdit = (val) => {
        setOutput(val);
        setInput(val); // Simple sync
    };
    // Drag Splitter
    const handleMouseDown = (e) => {
        e.preventDefault();
        const handleMouseMove = (moveEvent) => {
            const newPos = (moveEvent.clientX / window.innerWidth) * 100;
            if (newPos > 10 && newPos < 90)
                setSplitPos(newPos);
        };
        const handleMouseUp = () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };
    // Toolbar Actions
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(output);
            setNotification(t.copied);
            setTimeout(() => setNotification(""), 2000);
        }
        catch (err) {
            setNotification(t.failedCopy);
        }
    };
    // Node Copy Handler
    const handleNodeCopy = (text, type) => {
        navigator.clipboard.writeText(text).then(() => {
            const msg = type === "key" ? t.nodeKeyCopied : t.nodeValueCopied;
            setNotification(msg);
            setTimeout(() => setNotification(""), 2000);
        });
    };
    return (_jsxs("div", { className: "flex flex-col h-screen w-full text-[#cccccc]", children: [_jsxs("div", { className: "h-12 bg-[#252526] border-b border-[#3e3e42] flex items-center justify-between px-4 select-none", children: [_jsxs("div", { className: "font-bold text-[#007acc]", children: ["Beautify", _jsx("span", { className: "text-white", children: "Web" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "relative flex items-center bg-[#3c3c3c] rounded overflow-hidden border border-[#555] mr-2", children: [_jsx("div", { className: "pl-2 text-gray-400", children: _jsxs("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "11", cy: "11", r: "8" }), _jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })] }) }), _jsx("input", { type: "text", className: "bg-transparent border-none text-sm text-white px-2 py-1 w-40 focus:outline-none placeholder-gray-500", placeholder: t.searchPlaceholder, value: searchTerm, onChange: (e) => setSearchTerm(e.target.value), onKeyDown: (e) => {
                                            if (e.key === "Enter") {
                                                if (e.shiftKey)
                                                    prevMatch();
                                                else
                                                    nextMatch();
                                            }
                                        } }), searchMatches.length > 0 && (_jsxs("div", { className: "flex items-center border-l border-[#555] pl-2", children: [_jsxs("span", { className: "text-xs text-gray-400 mr-2", style: { minWidth: "30px", textAlign: "center" }, children: [currentMatchIndex + 1, "/", searchMatches.length] }), _jsx("button", { onClick: prevMatch, className: "p-1 hover:bg-[#555] text-gray-300 hover:text-white", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M18 15l-6-6-6 6" }) }) }), _jsx("button", { onClick: nextMatch, className: "p-1 hover:bg-[#555] text-gray-300 hover:text-white", children: _jsx("svg", { width: "14", height: "14", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: _jsx("path", { d: "M6 9l6 6 6-6" }) }) })] }))] }), _jsxs("select", { className: "bg-[#3e3e42] text-white text-xs rounded px-2 py-1 border border-[#555] outline-none mr-2 hover:bg-[#4e4e4e] cursor-pointer", value: uiLang, onChange: (e) => setUiLang(e.target.value), children: [_jsx("option", { value: "zh", children: t.langZh }), _jsx("option", { value: "en", children: t.langEn })] }), _jsx("button", { onClick: () => setMode((m) => (m === "edit" ? "preview" : "edit")), className: `px-3 py-1 rounded text-sm ${mode === "edit" ? "bg-[#007acc] text-white" : "bg-[#3e3e42] hover:bg-[#4e4e4e]"}`, children: mode === "edit" ? t.doneEditing : t.editMode }), _jsx("button", { onClick: () => setMode((m) => (m === "graph" ? "preview" : "graph")), className: `px-3 py-1 rounded text-sm ${mode === "graph" ? "bg-[#007acc] text-white" : "bg-[#3e3e42] hover:bg-[#4e4e4e]"}`, children: mode === "graph" ? t.codeViewBtn : t.structureGraph }), mode === "graph" && (_jsx("button", { onClick: () => graphResetRef.current && graphResetRef.current(), className: "px-3 py-1 rounded text-sm bg-[#3e3e42] hover:bg-[#4e4e4e]", children: t.refreshGraph })), _jsx("button", { onClick: copyToClipboard, className: "px-3 py-1 rounded text-sm bg-[#333] hover:bg-[#444] border border-[#444]", children: t.copy }), _jsx("button", { onClick: () => setSettingsOpen(true), className: "ml-2 p-2 hover:bg-[#3e3e42] rounded", children: _jsx("svg", { width: "20", height: "20", viewBox: "0 0 24 24", fill: "white", children: _jsx("path", { d: "M3 6h18v2H3V6zm0 5h18v2H3v-2zm0 5h18v2H3v-2zm0 5h18v2H3v-2z" }) }) })] })] }), _jsxs("div", { className: "flex-1 flex overflow-hidden relative", children: [_jsxs("div", { style: { width: `${splitPos}%` }, className: "h-full flex flex-col border-r border-[#3e3e42]", children: [_jsxs("div", { className: "bg-[#1e1e1e] text-xs px-4 py-1 text-gray-500 border-b border-[#2d2d2d] flex justify-between", children: [_jsx("span", { children: mode === "graph" ? t.codeView : t.input }), _jsx("span", { children: lang.toUpperCase() })] }), mode === "graph" ? (_jsx("div", { className: "flex-1 overflow-auto bg-[#1e1e1e]", children: _jsx(CodeOutput, { content: output, lang: lang, selectedId: highlightedId, onSelect: setHighlightedId, options: options }) })) : (_jsx(Editor, { ref: leftEditorRef, value: input, onChange: setInput }))] }), _jsx("div", { className: "w-1 bg-[#2d2d2d] hover:bg-[#007acc] cursor-col-resize z-10 transition-colors", onMouseDown: handleMouseDown }), _jsxs("div", { style: { width: `${100 - splitPos}%` }, className: "h-full flex flex-col bg-[#1e1e1e]", children: [_jsx("div", { className: "bg-[#1e1e1e] text-xs px-4 py-1 text-gray-500 border-b border-[#2d2d2d]", children: mode === "graph"
                                    ? t.structure
                                    : mode === "edit"
                                        ? t.editOutput
                                        : t.preview }), _jsxs("div", { className: "flex-1 overflow-auto relative", children: [mode === "edit" && (_jsx(Editor, { ref: rightEditorRef, value: output, onChange: handleOutputEdit })), mode === "preview" && (_jsx(CodeOutput, { content: output, lang: lang, selectedId: highlightedId, onSelect: setHighlightedId, options: options })), mode === "graph" &&
                                        (lang === "json" || lang === "xml" || lang === "css" ? (_jsx(GraphViewer, { data: output, lang: lang, onResetRef: graphResetRef, selectedId: highlightedId, onSelect: setHighlightedId, t: t, onCopy: handleNodeCopy, copyMode: options.graph_copy_mode })) : (_jsx("div", { className: "flex items-center justify-center h-full text-gray-500", children: t.graphError })))] })] }), notification && (_jsx("div", { className: "absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-[#007acc] text-white px-4 py-2 rounded shadow-lg text-sm animate-fade-in-up", children: notification }))] }), _jsx(SettingsSidebar, { open: settingsOpen, onClose: () => setSettingsOpen(false), options: options, onOptionChange: setOptions, t: t })] }));
};
const root = createRoot(document.getElementById("root"));
root.render(_jsx(App, {}));
