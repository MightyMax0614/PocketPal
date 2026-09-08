#!/bin/bash
set -u
cd -- "$(dirname -- "$0")" || exit 1
printf '\nPocketPal · 픽셀 친구 0.3\n'
pocketpal_python=""
for pocketpal_candidate in /opt/homebrew/bin/python3 /usr/local/bin/python3; do
  if [ -x "$pocketpal_candidate" ] && "$pocketpal_candidate" -c 'import sys; sys.exit(sys.version_info < (3,9))' 2>/dev/null; then
    pocketpal_python="$pocketpal_candidate"
    break
  fi
done
if [ -z "$pocketpal_python" ]; then
  pocketpal_candidate="$(command -v python3 || true)"
  if [ "$pocketpal_candidate" = /usr/bin/python3 ] && ! xcode-select -p >/dev/null 2>&1; then
    pocketpal_candidate=""
  fi
  if [ -n "$pocketpal_candidate" ] && "$pocketpal_candidate" -c 'import sys; sys.exit(sys.version_info < (3,9))' 2>/dev/null; then
    pocketpal_python="$pocketpal_candidate"
  fi
fi
if [ -z "$pocketpal_python" ]; then
  printf '\nPython 3.9 이상이 필요해요. https://www.python.org/downloads/macos/ 에서 Python을 설치하고 다시 열어 주세요.\n'
  printf '추가 Python 패키지나 Xcode 설치는 필요하지 않아요.\n'
  read -r -p 'Enter를 누르면 닫습니다. ' pocketpal_response
  exit 1
fi
if [ "${1:-}" = "--test" ]; then
  printf '\n기억·백업·아이별 데이터 분리를 임시 데이터로 검사합니다. 실제 가족 데이터는 사용하지 않습니다.\n'
  "$pocketpal_python" -m unittest discover -s tests -p 'test_mac_lab.py' -v
  pocketpal_status=$?
  printf '\n이 검사는 화면·카메라·음성·실제 AI 품질 검사를 포함하지 않습니다.\n'
  read -r -p '결과 확인 후 Enter를 누르면 닫습니다. ' pocketpal_response
  exit "$pocketpal_status"
fi
"$pocketpal_python" tools/mac_server.py --open
pocketpal_status=$?
if [ "$pocketpal_status" -ne 0 ]; then
  read -r -p '위 오류를 확인한 뒤 Enter를 누르세요. ' pocketpal_response
fi
exit "$pocketpal_status"
