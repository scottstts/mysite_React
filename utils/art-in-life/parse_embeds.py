# Run this script once to build the TypeScript data file for this tab.
# This script is designed to be run every time the embed.md file is updated.
# It writes a compact URL list plus a minimal official Instagram blockquote
# builder. The gallery owns its own loading placeholder, so we avoid embedding
# Instagram's large placeholder template in the app bundle.

import os
import re
from pathlib import Path

def parse_embed_md(input_file, output_file):
    """
    Parses an MD file to extract Instagram embed URLs and writes them to a TS
    data file with a small helper for lazy runtime embed mounting.
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

        # Build the TS output
        ts_output = ""
        ts_output += "const urls = [\n"
        for url in urls:
            ts_output += f"  '{url}',\n"
        ts_output += "];\n\n"

        ts_output += "export const artInLifeUrls = urls;\n\n"
        ts_output += "export const createInstagramEmbedHtml = (url: string): string => `\n"
        ts_output += "  <blockquote\n"
        ts_output += "    class=\"instagram-media\"\n"
        ts_output += "    data-instgrm-permalink=\"${url}\"\n"
        ts_output += "    data-instgrm-version=\"14\"\n"
        ts_output += "    style=\"background:#fff;border:0;margin:0;min-width:0;width:100%;\"\n"
        ts_output += "  ></blockquote>\n"
        ts_output += "`;\n"

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
