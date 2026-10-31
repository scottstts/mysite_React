import { safeHtml } from '@/lib/safeHtml';

// A lead quote is a paragraph that is nothing but the highlighted span.
const QUOTE = /^<span[^>]*\btext-yellow-200\b[^>]*>[\s\S]*<\/span>$/;

interface ParagraphsProps {
  html: string;
  className?: string;
}

// Data text separates paragraphs with <br><br>. In columns that gap can land
// at the top of a column as an empty line, so each paragraph becomes a real
// <p> whose spacing is a bottom margin, which columns drop at a break.
const Paragraphs = ({ html, className = 'prose' }: ParagraphsProps) => (
  <div className={className}>
    {html
      .split(/(?:\s*<br\s*\/?>\s*){2,}/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part, index) => (
        <p
          key={index}
          className={index === 0 && QUOTE.test(part) ? 'quote' : undefined}
          dangerouslySetInnerHTML={safeHtml(part)}
        />
      ))}
  </div>
);

export default Paragraphs;
