"use client";

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play as PlayIcon, Download as DownloadIcon } from '@phosphor-icons/react';
import type { PyodideInterface } from '@/types/pyodide';

interface TableRendererProps {
  pythonCode: string;
  description?: string;
  patientData?: any;
}

export function TableRenderer({ pythonCode, description, patientData }: TableRendererProps) {
  const [pyodide, setPyodide] = useState<PyodideInterface | null>(null);
  const [loading, setLoading] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tableData, setTableData] = useState<any>(null);

  const initializePyodide = async () => {
    if (pyodide) return pyodide;
    
    try {
      setLoading(true);
      const pyodideInstance = await window.loadPyodide();
      
      await pyodideInstance.loadPackage(['pandas', 'numpy']);
      
      setPyodide(pyodideInstance);
      return pyodideInstance;
    } catch (err) {
      setError(`Failed to initialize Pyodide: ${err}`);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const executeCode = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pyodideInstance = await initializePyodide();
      
      if (patientData) {
        pyodideInstance.globals.set('patient_data', patientData);
      }
      const wrappedCode = `
import pandas as pd
import numpy as np

${pythonCode}

# Capture the table data
try:
    # Look for common dataframe variable names
    table_vars = ['df', 'data', 'table', 'result', 'results']
    captured_table = None
    
    for var_name in table_vars:
        if var_name in locals() and isinstance(locals()[var_name], pd.DataFrame):
            captured_table = locals()[var_name].to_dict('records')
            break
    
    # If no standard variable found, check for any DataFrame in locals
    if captured_table is None:
        for name, obj in locals().items():
            if isinstance(obj, pd.DataFrame) and not name.startswith('_'):
                captured_table = obj.to_dict('records')
                break
    
    # Make the table data available
    table_data = captured_table
    
except Exception as e:
    print(f"Error capturing table: {e}")
    table_data = None
`;

      pyodideInstance.runPython(wrappedCode);
      const tableResult = pyodideInstance.globals.get('table_data');
      
      if (tableResult) {
        setTableData(tableResult);
        setExecuted(true);
      } else {
        throw new Error('No table was generated');
      }
      
    } catch (err) {
      setError(`Execution error: ${err}`);
      console.error('Python execution error:', err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (!tableData) return;
    
    // Convert table data to CSV
    const headers = Object.keys(tableData[0]);
    const csvContent = [
      headers.join(','),
      ...tableData.map((row: any) => headers.map(h => `"${row[h] || ''}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'medical-table.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="border rounded-lg p-4 bg-gradient-to-br from-well/50 to-ok-soft dark:from-slate-900 dark:to-green-950">
      {description && (
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
      )}
      
      {/* Python Code Display */}
      <div className="bg-ink text-ok p-3 rounded-md mb-4 overflow-x-auto">
        <pre className="text-xs font-mono whitespace-pre-wrap">{pythonCode}</pre>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 mb-4">
        <Button 
          onClick={executeCode} 
          disabled={loading}
          className="bg-ok hover:bg-ok"
        >
          <PlayIcon className="w-4 h-4 mr-2" />
          {loading ? 'Generating Table...' : 'Execute & Generate Table'}
        </Button>
        
        {tableData && (
          <Button variant="outline" onClick={downloadCSV}>
            <DownloadIcon className="w-4 h-4 mr-2" />
            Download CSV
          </Button>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-critical-soft border border-critical-line text-critical p-3 rounded-md mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Table Display */}
      {tableData && (
        <div className="table-glass rounded-lg overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-card border-b border-border">
                <tr>
                  {Object.keys(tableData[0]).map((header) => (
                    <th key={header} className="px-4 py-2 text-left font-medium text-ink">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row: any, index: number) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-card' : 'bg-card'}>
                    {Object.keys(tableData[0]).map((header) => (
                      <td key={header} className="px-4 py-2 text-ink">
                        {row[header] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ok-line"></div>
          <span className="ml-2 text-sm text-muted-foreground">
            {pyodide ? 'Executing Python code...' : 'Loading Python environment...'}
          </span>
        </div>
      )}

      {/* Success State */}
      {executed && tableData && (
        <div className="text-sm text-ok mt-2 flex items-center">
          ✓ Table generated successfully! {tableData.length} rows displayed.
        </div>
      )}
    </div>
  );
} 