# Attaching large files

A document is one HTML file, so do not embed large files (archives, logs,
datasets, recordings, binaries) in it. Upload them to slashdocs-files and link
them instead:

```bash
slashdocs-attach report-logs.tar.gz       # prints the download URL
slashdocs-attach capture.pcap 30          # same, but the file expires in 30 days
```

- Link the printed URL in the doc with the file name and size in the link text,
  e.g. `<a href="URL">report-logs.tar.gz (180 MB)</a>`.
- Files are kept until deleted unless you pass an expiry in days. Links are
  unguessable but work for anyone on the tailnet who has them.
- The key (in `~/.config/slashdocs/files.env`) can only upload: it cannot list,
  download or delete files. Never print or paste it. To delete a file, ask the
  user (admin UI: https://slashdocs-files.internal.sidhantunnithan.com/admin).
- If `slashdocs-attach` is missing or reports no key, tell the user to rerun
  setup_claude.bash with `SLASHDOCS_FILES_KEY=<key>`.
