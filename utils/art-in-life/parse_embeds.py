# Run this script once to build the TypeScript data file for this tab.
# This script is designed to be run every time the embed.md file is updated.
# It automatically adds data-instgrm-class="loading-lazy" for native lazy loading optimization.

import os
import re
from pathlib import Path

def parse_embed_md(input_file, output_file):
    """
    Parses an MD file to extract Instagram embed blockquotes and writes them
    to a TS data file, separating the template from the unique URLs.
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find all blockquote tags.
        embed_tags = re.findall(
            r'(<blockquote class="instagram-media".*?</blockquote>)',
            content,
            re.DOTALL,
        )

        if not embed_tags:
            print("No embed tags found.")
            return

        # Extract URLs from each tag
        urls = []
        for tag in embed_tags:
            match = re.search(r'data-instgrm-permalink="(.*?)"', tag)
            if match:
                urls.append(match.group(1))

        # Remove duplicates while preserving order
        seen = set()
        unique_urls = []
        duplicates = []
        for url in urls:
            if url not in seen:
                seen.add(url)
                unique_urls.append(url)
            else:
                duplicates.append(url)

        if duplicates:
            print(f"Removed {len(duplicates)} duplicate URL(s):")
            for dup in duplicates:
                print(f"  - {dup}")

        urls = unique_urls

        # Create a template from the first embed tag, replacing the URL with a placeholder.
        template_tag = embed_tags[0]
        first_url = urls[0]
        placeholder = 'URL_PLACEHOLDER'

        # Replace the URL in both data-instgrm-permalink and the href attributes
        template_html = template_tag.replace(first_url, placeholder)

        # Add the data-instgrm-class="loading-lazy" attribute for native lazy loading
        template_html = template_html.replace(
            'data-instgrm-version="14"',
            'data-instgrm-version="14" data-instgrm-class="loading-lazy"',
        )

        template_html = (
            template_html.replace('`', '\\`')
            .replace('\\n', ' ')
            .replace('\n', ' ')
            .strip()
        )

        # Build the TS output
        ts_output = "const embedTemplate = `"
        ts_output += f"{template_html}"
        ts_output += "`;\n\n"

        ts_output += "const urls = [\n"
        for url in urls:
            ts_output += f"  '{url}',\n"
        ts_output += "];\n\n"

        ts_output += "export const artInLifeData: string[] = urls.map((url) => {\n"
        ts_output += f"  return embedTemplate.replace(/{placeholder}/g, url);\n"
        ts_output += "});\n"

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(ts_output)

        print(
            f"Successfully parsed {len(urls)} embeds from {input_file} "
            f"and wrote to {output_file} with a new structure."
        )

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parents[1]
    input_md = script_dir / 'embed.md'
    output_ts = (
        project_root / 'src' / 'features' / 'art-in-life' / 'artInLife.data.ts'
    )
    parse_embed_md(os.fspath(input_md), os.fspath(output_ts))
