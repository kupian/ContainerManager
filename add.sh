#!/bin/bash

CONFIG_FILE="server/images.json"

# Get input from the user
read -p "Label: " LABEL
read -p "Image name: " IMAGE

# Ensure file is valid JSON
if ! jq empty "$CONFIG_FILE" 2>/dev/null; then
    echo "Error: Invalid JSON format in $CONFIG_FILE"
    exit 1
fi

# Add the new entry
jq --arg label "$LABEL" --arg image "$IMAGE" '. += [{"label": $label, "image": $image}]' "$CONFIG_FILE" > tmp.json && mv tmp.json "$CONFIG_FILE"

echo "Added: {\"label\": \"$LABEL\", \"image\": \"$IMAGE\"}"