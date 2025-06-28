import re
import os

def parse_embed_md(input_file, output_file):
    """
    Parses an MD file to extract Instagram embed blockquotes and writes them
    to a JS data file, separating the template from the unique URLs.
    """
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # Regex to find all blockquote tags.
        embed_tags = re.findall(r'(<blockquote class="instagram-media".*?</blockquote>)', content, re.DOTALL)

        if not embed_tags:
            print("No embed tags found.")
            return

        # Extract URLs from each tag
        urls = []
        for tag in embed_tags:
            match = re.search(r'data-instgrm-permalink="(.*?)"', tag)
            if match:
                urls.append(match.group(1))

        # Create a template from the first embed tag, replacing the URL with a placeholder.
        template_tag = embed_tags[0]
        first_url = urls[0]
        placeholder = 'URL_PLACEHOLDER'
        
        # Replace the URL in both data-instgrm-permalink and the href attributes
        template_html = template_tag.replace(first_url, placeholder)
        template_html = template_html.replace('`', '\\`').replace('\\n', ' ').replace('\n', ' ').strip()
        
        # Build the JS output
        js_output = "const embedTemplate = (\n"
        js_output += f"  `{template_html}`\n"
        js_output += ");\n\n"
        
        js_output += "const urls = [\n"
        for url in urls:
            js_output += f'  "{url}",\n'
        js_output += "];\n\n"
        
        js_output += "export const artOfLifeData = urls.map(url => {\n"
        js_output += f"  return embedTemplate.replace(/{placeholder}/g, url);\n"
        js_output += "});\n"


        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(js_output)

        print(f"Successfully parsed {len(urls)} embeds from {input_file} and wrote to {output_file} with a new structure.")

    except FileNotFoundError:
        print(f"Error: Input file not found at {input_file}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    input_md = os.path.join(script_dir, 'embed.md')
    output_js = os.path.join(script_dir, 'artOfLife.data.js')
    parse_embed_md(input_md, output_js) 