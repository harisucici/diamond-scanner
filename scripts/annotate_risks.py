#!/usr/bin/env python3
"""
CAD Risk Annotation Script
Uses Pillow to draw risk markers on CAD images based on AI analysis text.

Input:  base64 image + analysis text with numbered risk items
Output: annotated image as base64

Usage:
  python3 annotate_risks.py --image <base64> --analysis <text> --output <output_base64_file>
  
The script parses analysis text looking for patterns like:
  ### 1 xxxxx  or  [1] xxxxx  or  ① xxxxx
and draws numbered circles on the image at estimated positions.

If Pillow is not available, returns the original image unchanged.
"""

import argparse
import base64
import io
import json
import re
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Risk level colors (R, G, B, A)
RISK_COLORS = {
    "high":   (220, 38, 38, 220),    # Red
    "medium": (234, 179, 8, 220),    # Yellow
    "low":    (34, 197, 94, 220),    # Green
    "info":   (107, 114, 128, 200),  # Gray
}

RISK_EMOJIS = {
    "high": "🔴",
    "medium": "🟡",
    "low": "🟢",
    "info": "⚪",
}


def detect_risk_level(text: str) -> str:
    """Detect risk level from text content."""
    low = text.lower()
    if any(kw in low for kw in ["🔴", "high", "严重", "高风险", "断裂", "掉石", "无法"]):
        return "high"
    if any(kw in low for kw in ["🟡", "medium", "中风险", "中等", "可能"]):
        return "medium"
    if any(kw in low for kw in ["🟢", "low", "低风险", "轻微", "细节"]):
        return "low"
    if any(kw in low for kw in ["⚪", "待确认", "未知", "信息不足"]):
        return "info"
    return "info"


def parse_risk_items(analysis_text: str) -> list:
    """
    Parse the AI analysis text to extract numbered risk items.
    Returns list of dicts: [{num, title, level, description}, ...]
    """
    items = []

    # Pattern 1: ### 1 Title or ### [1] Title
    pattern1 = re.compile(
        r'#{1,3}\s*(?:\[(\d+)\]|(\d+))\s*(.+?)(?=\n|$)',
        re.MULTILINE
    )

    # Pattern 2: ① Title or [1] Title without markdown headers
    pattern2 = re.compile(
        r'(?:\[(\d+)\]|(\d+)[、.．]\s*)(.+?)(?=\n|$)',
        re.MULTILINE
    )

    # Pattern 3: Emoji-numbered like 🔴 1 xxx
    pattern3 = re.compile(
        r'[🔴🟡🟢⚪️\s]*(?:\[(\d+)\]|(\d+))\s*(.+?)(?=\n|$)',
        re.MULTILINE
    )

    seen = set()

    for match in pattern1.finditer(analysis_text):
        num = int(match.group(1) or match.group(2))
        title = match.group(3).strip()
        if num not in seen and title:
            seen.add(num)
            items.append({
                "num": num,
                "title": title[:60],
                "level": detect_risk_level(analysis_text.split(f"### {num}" if match.group(2) else f"### [{num}]")[1].split("###")[0] if f"### {num}" in analysis_text or f"### [{num}]" in analysis_text else "")
            })

    if not items:
        for match in pattern2.finditer(analysis_text):
            num = int(match.group(1) or match.group(2))
            title = match.group(3).strip()
            if num not in seen and 1 <= num <= 30 and title and len(title) < 100:
                seen.add(num)
                items.append({
                    "num": num,
                    "title": title[:60],
                    "level": detect_risk_level(title)
                })

    # Sort by number
    items.sort(key=lambda x: x["num"])

    # If no items found, create a generic marker
    if not items:
        items.append({
            "num": 1,
            "title": "AI分析 - 详见报告",
            "level": "info"
        })

    return items


def calculate_positions(num_items: int, image_width: int, image_height: int) -> list:
    """
    Calculate marker positions on the image.
    Distributes markers evenly across the image in a grid pattern.
    """
    positions = []

    if num_items <= 1:
        return [(image_width // 2, image_height // 2)]

    # Calculate grid
    cols = max(2, int(num_items ** 0.5))
    rows = (num_items + cols - 1) // cols

    margin_x = image_width // 6
    margin_y = image_height // 6
    usable_w = image_width - 2 * margin_x
    usable_h = image_height - 2 * margin_y

    for i in range(num_items):
        row = i // cols
        col = i % cols
        x = margin_x + (col + 0.5) * usable_w / cols
        y = margin_y + (row + 0.5) * usable_h / rows
        positions.append((int(x), int(y)))

    return positions


def annotate_image(image_base64: str, risk_items: list, output_format: str = "png") -> str:
    """
    Draw risk markers on the image and return base64 encoded result.
    """
    if not PIL_AVAILABLE:
        return image_base64

    try:
        # Decode image
        # Remove data URL prefix if present
        if "," in image_base64:
            image_base64 = image_base64.split(",", 1)[1]

        img_bytes = base64.b64decode(image_base64)
        img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")

        width, height = img.size

        # Create overlay
        overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
        draw = ImageDraw.Draw(overlay)

        # Scale marker size based on image dimensions
        marker_size = max(20, min(width, height) // 20)
        font_size = max(12, marker_size - 2)

        # Try to load a font, fall back to default
        try:
            font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", font_size)
        except (IOError, OSError):
            try:
                font = ImageFont.truetype("/System/Library/Fonts/Arial Unicode.ttf", font_size)
            except (IOError, OSError):
                font = ImageFont.load_default()

        # Calculate positions
        positions = calculate_positions(len(risk_items), width, height)

        for i, (item, pos) in enumerate(zip(risk_items, positions)):
            x, y = pos
            level = item.get("level", "info")
            color = RISK_COLORS.get(level, RISK_COLORS["info"])
            num = item["num"]
            title = item["title"]

            # Draw circle
            r = marker_size
            draw.ellipse([x - r, y - r, x + r, y + r], fill=color, outline=(255, 255, 255, 200), width=2)

            # Draw number inside circle
            num_text = str(num)
            # Get text bbox
            bbox = draw.textbbox((0, 0), num_text, font=font)
            text_w = bbox[2] - bbox[0]
            text_h = bbox[3] - bbox[1]
            text_x = x - text_w // 2
            text_y = y - text_h // 2
            draw.text((text_x, text_y), num_text, fill=(255, 255, 255, 255), font=font)

            # Draw label below circle
            label = f"{num}. {title[:25]}"
            label_bbox = draw.textbbox((0, 0), label, font=font)
            label_w = label_bbox[2] - label_bbox[0]

            # Background for label
            pad = 4
            label_y = y + r + 4
            draw.rounded_rectangle(
                [x - label_w // 2 - pad, label_y - pad,
                 x + label_w // 2 + pad, label_y + font_size + pad],
                radius=4,
                fill=(0, 0, 0, 180)
            )
            draw.text((x - label_w // 2, label_y), label, fill=(255, 255, 255, 230), font=font)

        # Composite
        result = Image.alpha_composite(img, overlay)

        # Convert to output format
        if output_format.lower() == "jpeg":
            result = result.convert("RGB")
            fmt = "JPEG"
        else:
            fmt = "PNG"

        buf = io.BytesIO()
        result.save(buf, format=fmt, quality=95)
        buf.seek(0)

        return base64.b64encode(buf.getvalue()).decode("utf-8")

    except Exception as e:
        print(f"Annotation error: {e}", file=sys.stderr)
        return image_base64


def main():
    parser = argparse.ArgumentParser(description="Annotate CAD image with risk markers")
    parser.add_argument("--image", required=True, help="Base64 encoded image")
    parser.add_argument("--analysis", required=True, help="AI analysis text")
    parser.add_argument("--output", help="Output file for base64 result (optional, prints to stdout if not specified)")
    parser.add_argument("--format", default="png", choices=["png", "jpeg"], help="Output image format")

    args = parser.parse_args()

    # Parse risk items from analysis text
    risk_items = parse_risk_items(args.analysis)

    # Annotate image
    result_b64 = annotate_image(args.image, risk_items, args.format)

    if args.output:
        with open(args.output, "w") as f:
            f.write(result_b64)
    else:
        print(result_b64)


if __name__ == "__main__":
    main()
