const escapeHtml = (value) => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const formatText = (text, action) => {
  const original = String(text || '');
  const trimmed = original.trim();

  switch (action) {
    case 'bold':
      return trimmed ? `**${trimmed}**` : '**bold text**';
    case 'italic':
      return trimmed ? `_${trimmed}_` : '_italic text_';
    case 'underline':
      return trimmed ? `<u>${trimmed}</u>` : '<u>underlined text</u>';
    case 'strikethrough':
      return trimmed ? `~~${trimmed}~~` : '~~strikethrough text~~';
    case 'code':
      return trimmed.includes('\n')
        ? `\`\`\`\n${trimmed}\n\`\`\``
        : `\`${trimmed || 'code'}\``;
    case 'heading': {
      const lines = (trimmed || 'Heading text').split('\n');
      return lines.map((line) => (line.startsWith('# ') ? line : `# ${line}`)).join('\n');
    }
    case 'list': {
      const lines = (trimmed || 'List item').split('\n');
      return lines.map((line) => line.replace(/^([-*+]\s*)?/, '- ')).join('\n');
    }
    case 'type': {
      let result = trimmed;
      result = result.replace(/^\*\*(.*)\*\*$/s, '$1');
      result = result.replace(/^_(.*)_$/s, '$1');
      result = result.replace(/^~~(.*)~~$/s, '$1');
      result = result.replace(/^<u>(.*)<\/u>$/s, '$1');
      result = result.replace(/^`(.*)`$/s, '$1');
      return result || 'plain text';
    }
    default:
      return trimmed || 'text';
  }
};

const renderFormattedMarkup = (text = '') => {
  const original = String(text || '');
  const preserved = original
    .replace(/<u>/g, '__U_OPEN__')
    .replace(/<\/u>/g, '__U_CLOSE__');

  let escaped = escapeHtml(preserved)
    .replace(/__U_OPEN__/g, '<u>')
    .replace(/__U_CLOSE__/g, '</u>');

  const codeBlocks = [];
  escaped = escaped.replace(/```([\s\S]*?)```/g, (_, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre class="formatted-code"><code>${escapeHtml(code)}</code></pre>`);
    return placeholder;
  });

  const lines = escaped.split('\n');
  const output = [];
  let inList = false;

  lines.forEach((line) => {
    const headingMatch = line.match(/^# (.+)/);
    const listMatch = line.match(/^\-\s+(.+)/);

    if (inList && !listMatch) {
      output.push('</ul>');
      inList = false;
    }

    if (headingMatch) {
      output.push(`<h3>${headingMatch[1]}</h3>`);
      return;
    }

    if (listMatch) {
      if (!inList) {
        output.push('<ul>');
        inList = true;
      }
      output.push(`<li>${listMatch[1]}</li>`);
      return;
    }

    if (line.trim() === '') {
      output.push('<br>');
      return;
    }

    output.push(`<p>${line}</p>`);
  });

  if (inList) {
    output.push('</ul>');
  }

  let html = output.join('');

  html = html
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>');

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  return html;
};

const isHtmlString = (value) => /<\/?[a-z][\s\S]*>/i.test(String(value || ''));

const renderRichText = (text = '') => {
  if (!text) return '';
  return isHtmlString(text) ? text : renderFormattedMarkup(text);
};

export { formatText, renderFormattedMarkup, renderRichText };