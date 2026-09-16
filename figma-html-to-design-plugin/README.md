# HTML to Design Importer

Local Figma plugin for importing pasted HTML as editable Figma layers.

## Install in Figma

1. Open Figma Desktop.
2. Go to `Plugins` -> `Development` -> `Import plugin from manifest...`.
3. Select:

```text
figma-html-to-design-plugin/manifest.json
```

## Use

1. Run the plugin.
2. Paste HTML into the text area.
3. Set the viewport size, such as `390 x 844` for the iPhone mockup.
4. Click `Import to Figma`.

## Notes

This creates editable Figma rectangles and text layers from visible HTML elements. It is intentionally not a pixel-perfect browser renderer. Complex React state, canvas, video, CSS filters, and remote images may import as simplified editable boxes.

For the NGA prototype, paste the contents of `../index.html` and use a `390 x 844` viewport.
