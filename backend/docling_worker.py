#!/usr/bin/env python3
"""
Docling worker — processes a note file and stores the markdown result in PostgreSQL.

Usage:
    python docling_worker.py --file <path> --note-id <id> --db-url <url>

Progress is reported to stdout as JSON lines: {"progress": <0-100>}
Final result is written to the DB.
"""

import argparse
import json
import sys
import os
import traceback
import logging

# Suppress noisy RapidOCR / Docling WARNING messages (e.g. "empty result")
# before any docling import so handlers are set early.
logging.getLogger("RapidOCR").setLevel(logging.ERROR)
logging.getLogger("docling").setLevel(logging.ERROR)
logging.getLogger("docling_core").setLevel(logging.ERROR)

import psycopg2
from docling.document_converter import DocumentConverter
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import PdfFormatOption


def emit(progress: int, message: str = ""):
    """Print a progress JSON line to stdout (Node will relay via SSE)."""
    data = {"progress": progress}
    if message:
        data["message"] = message
    print(json.dumps(data), flush=True)


def update_db(conn, note_id: int, status: str, progress: int, result: str | None = None):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE notes
               SET docling_status   = %s,
                   docling_progress = %s,
                   docling_result   = %s
             WHERE id = %s
            """,
            (status, progress, result, note_id),
        )
    conn.commit()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Absolute path to the file to process")
    parser.add_argument("--note-id", required=True, type=int, help="Note ID in DB")
    parser.add_argument("--db-url", required=True, help="PostgreSQL connection URL")
    args = parser.parse_args()

    conn = psycopg2.connect(args.db_url)

    try:
        emit(5, "Connected to database")
        update_db(conn, args.note_id, "processing", 5)

        file_path = args.file
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")

        emit(10, "Initialising Docling converter")

        # Configure pipeline — enable OCR for images, export as markdown
        pipeline_options = PdfPipelineOptions()
        # pipeline_options.do_formula_enrichment = True
        pipeline_options.do_ocr = True
        pipeline_options.do_table_structure = True

        converter = DocumentConverter(
            format_options={
                InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options),
            }
        )

        emit(20, "Starting document conversion")
        update_db(conn, args.note_id, "processing", 20)

        # Run conversion — this is the heavy part; no native progress callbacks
        result = converter.convert(file_path)

        emit(80, "Conversion complete, exporting markdown")
        update_db(conn, args.note_id, "processing", 80)

        # Export to markdown
        markdown_output = result.document.export_to_markdown()

        emit(95, "Saving result to database")
        update_db(conn, args.note_id, "done", 100, markdown_output)

        emit(100, "Done")

    except Exception:
        tb = traceback.format_exc()
        print(json.dumps({"progress": 0, "error": tb}), flush=True)
        try:
            update_db(conn, args.note_id, "error", 0)
        except Exception:
            pass
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
