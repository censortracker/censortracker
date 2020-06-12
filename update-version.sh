#!/bin/bash

version=$(jq '.version' package.json)
a=( $(grep -oE '[0-9]+|[0-9]+-[a-z]+[0-9]+' <<<"$version") )
((a[2]++))
new_version="${a[0]}.${a[1]}.${a[2]}"

sed -i "s/\"version\": $version/\"version\": \"$new_version\"/g" package.json
sed -i "s/\"version\": $version/\"version\": \"$new_version\"/g" src/chrome/manifest.json

git add .
