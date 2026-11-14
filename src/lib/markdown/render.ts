// A tiny, dependency-free Markdown-to-HTML renderer for CONTRIBUTING.md and
// prompts/add-entity.md (specs.md §7 `/{loc}/contribute` row). Deliberately
// not a full CommonMark implementation — the project's own style is "plain
// CSS, no framework" (§4.2), and these two files use only headings,
// paragraphs, fenced code blocks, bullet lists, blockquotes and inline code,
// so a full Markdown library would be a dependency for six constructs.
function escapeHtml(text: string): string {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderInline(text: string): string {
	let out = escapeHtml(text);
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
	return out;
}

export function renderMarkdown(markdown: string): string {
	const lines = markdown.split('\n');
	const html: string[] = [];
	let i = 0;
	let inList = false;
	let inQuote = false;

	function closeList(): void {
		if (inList) {
			html.push('</ul>');
			inList = false;
		}
	}
	function closeQuote(): void {
		if (inQuote) {
			html.push('</blockquote>');
			inQuote = false;
		}
	}

	while (i < lines.length) {
		const line = lines[i]!;

		if (line.startsWith('```')) {
			closeList();
			closeQuote();
			const codeLines: string[] = [];
			i++;
			while (i < lines.length && !lines[i]!.startsWith('```')) {
				codeLines.push(lines[i]!);
				i++;
			}
			html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
			i++;
			continue;
		}

		const heading = /^(#{1,4})\s+(.*)$/.exec(line);
		if (heading) {
			closeList();
			closeQuote();
			const level = heading[1]!.length;
			html.push(`<h${level}>${renderInline(heading[2]!)}</h${level}>`);
			i++;
			continue;
		}

		if (/^[-*]\s+/.test(line)) {
			closeQuote();
			if (!inList) {
				html.push('<ul>');
				inList = true;
			}
			html.push(`<li>${renderInline(line.replace(/^[-*]\s+/, ''))}</li>`);
			i++;
			continue;
		}

		if (line.startsWith('>')) {
			closeList();
			if (!inQuote) {
				html.push('<blockquote>');
				inQuote = true;
			}
			html.push(`<p>${renderInline(line.replace(/^>\s?/, ''))}</p>`);
			i++;
			continue;
		}

		if (line.trim() === '') {
			closeList();
			closeQuote();
			i++;
			continue;
		}

		closeList();
		closeQuote();
		html.push(`<p>${renderInline(line)}</p>`);
		i++;
	}

	closeList();
	closeQuote();
	return html.join('\n');
}
