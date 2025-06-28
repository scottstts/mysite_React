import re
import os

def parse_embed_md(input_file, output_file):
    """
    Parses an MD file to extract Instagram embed blockquotes and writes them
    to a JS data file.
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find all blockquote tags.
        # It handles multi-line blockquotes with the re.DOTALL flag.
        embed_tags = re.findall(r'(<blockquote class="instagram-media".*?<\/blockquote>)', content, re.DOTALL)

        js_output = "export const artOfLifeData = [\n"
        for tag in embed_tags:
            # Escape backticks and format for a JS template literal
            js_tag = tag.replace('`', '\\`').replace('\\n', ' ').replace('\n', ' ').strip()
            js_output += f"  `{js_tag}`,\n"
        js_output += "];\n"

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(js_output)

        print(f"Successfully parsed {len(embed_tags)} embeds from {input_file} and wrote to {output_file}")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    # Get the directory of the script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_md = os.path.join(script_dir, 'embed.md')
    output_js = os.path.join(script_dir, 'artOfLife.data.js')
    parse_embed_md(input_md, output_js) 