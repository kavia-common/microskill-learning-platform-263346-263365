#!/bin/bash
cd /home/kavia/workspace/code-generation/microskill-learning-platform-263346-263365/backend
npm run lint
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

