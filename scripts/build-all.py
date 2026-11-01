#!/usr/bin/env python3
"""Build release binaries offline from vendor. Run with Go 1.23+ on PATH."""
from pathlib import Path
import os
import subprocess

ROOT = Path(__file__).resolve().parent.parent
TARGETS = [('linux','amd64',''), ('windows','amd64','.exe'), ('darwin','arm64','-macos-arm64')]
for system, arch, suffix in TARGETS:
    for app in ('game-server','mcp-tools'):
        subprocess.run(['go','build','-mod=vendor','-buildvcs=false','-trimpath','-ldflags=-s -w','-o',str(ROOT/'bin'/(app+suffix)),'./cmd/'+app],cwd=ROOT,env=dict(os.environ,CGO_ENABLED='0',GOOS=system,GOARCH=arch),check=True)
        print(system,arch,app,'built')
