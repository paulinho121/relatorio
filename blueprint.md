# Blueprint: NFe XML Report Generator

## Overview

This application allows users to select multiple Nota Fiscal Eletrônica (NFe) XML files, processes them, and generates a consolidated report. The report provides a summary of all processed invoices, grouped by company branch, and includes totals for invoiced amounts, freight costs, and DIFAL. The application is built as a Web Component, using vanilla HTML, CSS, and JavaScript, and runs entirely in the browser.

## Project Structure

- `index.html`: The main HTML file containing the Web Component and its styles.
- `logo.png`: The company logo.

## Style, Design, and Features

- **File Input**: Users can select multiple XML files.
- **Report Generation**: Generates a detailed report from the XML files.
- **Data Grouping**: Report data is grouped by `filial` (branch).
- **Summaries**: Provides totals for each branch and a general summary.
- **Cancellation Handling**: Correctly identifies and separates canceled invoices.
- **Professional Styling**: Uses a color scheme based on the company logo.
- **Printing**: Includes a print-friendly version of the report.
- **CSV Export**: Allows exporting the report data to a CSV file.
- **Responsive Design**: The layout adapts to different screen sizes.

## Current Plan: Professional Layout Enhancement

The user has requested a more professional layout for the report.

### Plan Steps:

1.  **Incorporate Logo**: The user has provided the company logo. It has been saved as `logo.png` and is displayed in the report header.
2.  **Enhance Typography**:
    *   Import and apply the 'Poppins' font from Google Fonts for a more modern and professional look.
    *   Adjust font sizes and weights to improve readability and visual hierarchy.
3.  **Improve Background and Shadows**:
    *   Add a subtle noise texture to the main body background to give it a premium feel.
    *   Update the box-shadow on the main container to create a "lifted" effect with more depth.
4.  **Refine Header**:
    *   Adjust the styling of the report header to better integrate the logo and report date.
5.  **General Polish**:
    *   Review and adjust spacing, alignment, and other minor visual details for a more polished final result.
