#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
exec bash ./Start_PocketPal.command --test
