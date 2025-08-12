import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { MONTHS } from '../../types/plan';
import type { StrategicObjective } from '../../types/organization';
import type { Language } from '../i18n/translations';

// Helper function to get selected months for a specific quarter
const getMonthsForQuarter = (selectedMonths: string[] | null, selectedQuarters: string[] | null, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string => {
  if (!selectedMonths && !selectedQuarters) return '-';
  
  // If quarters are selected, show all months in that quarter
  if (selectedQuarters && Array.isArray(selectedQuarters) && selectedQuarters.includes(quarter)) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter)
      .map(month => month.value);
    return quarterMonths.join(', ');
  }
  
  // If individual months are selected, show only selected months for that quarter
  if (selectedMonths && Array.isArray(selectedMonths) && selectedMonths.length > 0) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter && selectedMonths.includes(month.value))
      .map(month => month.value);
    return quarterMonths.length > 0 ? quarterMonths.join(', ') : '-';
  }
  
  return '-';
};

// Table headers in English and Amharic
const TABLE_HEADERS_EN = [
  'No.',
  'Strategic Objective',
  'Strategic Objective Weight',
  'Strategic Initiative',
  'Initiative Weight',
  'Performance Measure/Main Activity',
  'Weight',
  'Baseline',
  'Q1 Target',
  'Q1 Months',
  'Q2 Target',
  'Q2 Months',
  '6-Month Target',
  'Q3 Target',
  'Q3 Months',
  'Q4 Target',
  'Q4 Months',
  'Annual Target',
  'Implementor',
  'Budget Required',
  'Government',
  'Partners',
  'SDG',
  'Other',
  'Total Available',
  'Gap'
];

const TABLE_HEADERS_AM = [
  'ተ.ቁ',
  'ስትራቴጂክ ዓላማ',
  'የስትራቴጂክ ዓላማ ክብደት',
  'ስትራቴጂክ ተነሳሽነት',
  'የተነሳሽነት ክብደት',
  'የአፈጻጸም መለኪያ/ዋና እንቅስቃሴ',
  'ክብደት',
  'መነሻ',
  'የ1ኛ ሩብ ዓመት ዒላማ',
  'የ1ኛ ሩብ ወራት',
  'የ2ኛ ሩብ ዓመት ዒላማ',
  'የ2ኛ ሩብ ወራት',
  '6 ወር ዒላማ',
  'የ3ኛ ሩብ ዓመት ዒላማ',
  'የ3ኛ ሩብ ወራት',
  'የ4ኛ ሩብ ዓመት ዒላማ',
  'የ4ኛ ሩብ ወራት',
  'የዓመት ዒላማ',
  'ተግባሪ',
  'የሚያስፈልግ በጀት',
  'መንግስት',
  'አጋሮች',
  'SDG',
  'ሌላ',
  'ጠቅላላ ያለው',
  'ክፍተት'
];

const formatCurrency = (value: number | string | undefined): string => {
  if (value === undefined || value === null || value === '') return '$0';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return `$${numValue.toLocaleString()}`;
};

export const exportToExcel = async (
  data: any[],
  filename: string,
  language: Language = 'en',
  metadata?: {
    organization?: string;
    planner?: string;
    fromDate?: string;
    toDate?: string;
    planType?: string;
  }
) => {
  try {
    const workbook = XLSX.utils.book_new();
    
    // Select headers based on language
    const headers = language === 'am' ? TABLE_HEADERS_AM : TABLE_HEADERS_EN;
    
    // Create header row with styling
    const headerRow = headers.map(header => ({ v: header, t: 's' }));
    
    // Transform data to match table structure and add to worksheet
    const tableData = data.map(row => [
      row.No || '',
      row['Strategic Objective'] || '',
      row['Strategic Objective Weight'] || '',
      row['Strategic Initiative'] || '',
      row['Initiative Weight'] || '',
      row['Performance Measure/Main Activity'] || '',
      row.Weight || '',
      row.Baseline || '',
      row.Q1Target || '',
      row.Q1Months || '',
      row.Q2Target || '',
      row.Q2Months || '',
      row.SixMonthTarget || '',
      row.Q3Target || '',
      row.Q3Months || '',
      row.Q4Target || '',
      row.Q4Months || '',
      row.AnnualTarget || '',
      row.Implementor || '',
      formatCurrency(row.BudgetRequired),
      formatCurrency(row.Government),
      formatCurrency(row.Partners),
      formatCurrency(row.SDG),
      formatCurrency(row.Other),
      formatCurrency(row.TotalAvailable),
      formatCurrency(row.Gap)
    ]);

    // Create worksheet with headers and data
    const worksheetData = [headers, ...tableData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto-size columns
    const columnWidths = headers.map((_, colIndex) => {
      const maxLength = Math.max(
        headers[colIndex].length,
        ...tableData.map(row => String(row[colIndex] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 30) };
    });
    worksheet['!cols'] = columnWidths;

    // Add metadata sheet if provided
    if (metadata) {
      const metadataSheet = XLSX.utils.aoa_to_sheet([
        ['Plan Information', ''],
        ['Organization', metadata.organization || ''],
        ['Planner', metadata.planner || ''],
        ['Plan Type', metadata.planType || ''],
        ['From Date', metadata.fromDate || ''],
        ['To Date', metadata.toDate || ''],
        ['Generated On', new Date().toLocaleDateString()]
      ]);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Plan Info');
    }

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Strategic Plan');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch (error) {
    console.error('Failed to export Excel:', error);
    throw new Error('Failed to export to Excel');
  }
};

export const exportToPDF = async (
  data: any[],
  filename: string,
  language: Language = 'en',
  metadata?: {
    organization?: string;
    planner?: string;
    fromDate?: string;
    toDate?: string;
    planType?: string;
  }
) => {
  try {
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Select headers based on language
    const headers = language === 'am' ? TABLE_HEADERS_AM : TABLE_HEADERS_EN;
    
    // Transform data to match table structure
    const tableData = data.map(row => [
      row.No || '',
      row['Strategic Objective'] || '',
      row['Strategic Objective Weight'] || '',
      row['Strategic Initiative'] || '',
      row['Initiative Weight'] || '',
      row['Performance Measure/Main Activity'] || '',
      row.Weight || '',
      row.Baseline || '',
      `${row.Q1Target || ''}\n${row.Q1Months || ''}`,
      `${row.Q2Target || ''}\n${row.Q2Months || ''}`,
      row.SixMonthTarget || '',
      `${row.Q3Target || ''}\n${row.Q3Months || ''}`,
      `${row.Q4Target || ''}\n${row.Q4Months || ''}`,
      row.AnnualTarget || '',
      row.Implementor || '',
      formatCurrency(row.BudgetRequired),
      formatCurrency(row.Government),
      formatCurrency(row.Partners),
      formatCurrency(row.SDG),
      formatCurrency(row.Other),
      formatCurrency(row.TotalAvailable),
      formatCurrency(row.Gap)
    ]);

    // Add title and metadata
    if (metadata) {
      doc.setFontSize(16);
      doc.text(`${metadata.organization || 'Ministry of Health'} - Strategic Plan`, 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Planner: ${metadata.planner || 'N/A'}`, 20, 30);
      doc.text(`Plan Type: ${metadata.planType || 'N/A'}`, 20, 40);
      doc.text(`Period: ${metadata.fromDate || 'N/A'} - ${metadata.toDate || 'N/A'}`, 20, 50);
    }

    // Add table
    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: metadata ? 60 : 20,
      styles: {
        fontSize: 6,
        cellPadding: 1
      },
      headStyles: {
        fillColor: [59, 130, 246], // Blue color
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 8 },  // No.
        1: { cellWidth: 25 }, // Strategic Objective
        2: { cellWidth: 15 }, // Objective Weight
        3: { cellWidth: 25 }, // Strategic Initiative
        4: { cellWidth: 15 }, // Initiative Weight
        5: { cellWidth: 30 }, // PM/MA Name
        6: { cellWidth: 12 }, // Weight
        7: { cellWidth: 15 }, // Baseline
        8: { cellWidth: 20 }, // Q1 Target + Months
        9: { cellWidth: 20 }, // Q2 Target + Months
        10: { cellWidth: 15 }, // 6-Month Target
        11: { cellWidth: 20 }, // Q3 Target + Months
        12: { cellWidth: 20 }, // Q4 Target + Months
        13: { cellWidth: 15 }, // Annual Target
        14: { cellWidth: 20 }, // Implementor
        15: { cellWidth: 18 }, // Budget Required
        16: { cellWidth: 15 }, // Government
        17: { cellWidth: 15 }, // Partners
        18: { cellWidth: 12 }, // SDG
        19: { cellWidth: 12 }, // Other
        20: { cellWidth: 18 }, // Total Available
        21: { cellWidth: 15 }  // Gap
      }
    });

    doc.save(`${filename}.pdf`);
  } catch (error) {
    console.error('Failed to export PDF:', error);
    throw new Error('Failed to export to PDF');
  }
};

export const processDataForExport = (objectives: StrategicObjective[], language: Language = 'en'): any[] => {
  const exportData: any[] = [];
  
  if (!objectives || !Array.isArray(objectives)) {
    console.warn('No objectives to export');
    return exportData;
  }

  console.log('Converting objectives for export:', objectives.length);

  objectives.forEach((objective, objIndex) => {
    if (!objective) return;
    
    // Get objective weight (use effective_weight, planner_weight, or weight)
    const effectiveWeight = objective.effective_weight || objective.planner_weight || objective.weight;
    
    let objectiveAdded = false;
    
    if (!objective.initiatives || objective.initiatives.length === 0) {
      // Objective with no initiatives
      exportData.push({
        No: objIndex + 1,
        'Strategic Objective': objective.title || 'Untitled Objective',
        'Strategic Objective Weight': `${effectiveWeight}%`,
        'Strategic Initiative': '-',
        'Initiative Weight': '-',
        'Performance Measure/Main Activity': '-',
        'Weight': '-',
        'Baseline': '-',
        'Q1Target': '-',
        'Q1Months': '-',
        'Q2Target': '-',
        'Q2Months': '-',
        'SixMonthTarget': '-',
        'Q3Target': '-',
        'Q3Months': '-',
        'Q4Target': '-',
        'Q4Months': '-',
        'AnnualTarget': '-',
        'Implementor': 'Ministry of Health',
        'BudgetRequired': '-',
        'Government': '-',
        'Partners': '-',
        'SDG': '-',
        'Other': '-',
        'TotalAvailable': '-',
        'Gap': '-'
      });
    } else {
      objective.initiatives.forEach((initiative: any) => {
        if (!initiative) return;
        
        // Combine performance measures and main activities
        const performanceMeasures = (initiative.performance_measures || []).map((item: any) => ({ ...item, type: 'Performance Measure' }));
        const mainActivities = (initiative.main_activities || []).map((item: any) => ({ ...item, type: 'Main Activity' }));
        const allItems = [...performanceMeasures, ...mainActivities];
        
        if (allItems.length === 0) {
          // Initiative with no measures or activities
          exportData.push({
            No: objectiveAdded ? '' : (objIndex + 1).toString(),
            'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
            'Strategic Objective Weight': objectiveAdded ? '' : `${effectiveWeight}%`,
            'Strategic Initiative': initiative.name || 'Untitled Initiative',
            'Initiative Weight': `${initiative.weight || 0}%`,
            'Performance Measure/Main Activity': 'No measures or activities',
            'Weight': '-',
            'Baseline': '-',
            'Q1Target': '-',
            'Q1Months': '-',
            'Q2Target': '-',
            'Q2Months': '-',
            'SixMonthTarget': '-',
            'Q3Target': '-',
            'Q3Months': '-',
            'Q4Target': '-',
            'Q4Months': '-',
            'AnnualTarget': '-',
            'Implementor': initiative.organization_name || 'Ministry of Health',
            'BudgetRequired': '-',
            'Government': '-',
            'Partners': '-',
            'SDG': '-',
            'Other': '-',
            'TotalAvailable': '-',
            'Gap': '-'
          });
          objectiveAdded = true;
        } else {
          let initiativeAddedForObjective = false;
          
          allItems.forEach((item: any) => {
            if (!item) return;
            
            const isPerformanceMeasure = item.type === 'Performance Measure';
            
            // Calculate budget values (same logic as table)
            let budgetRequired = 0;
            let government = 0;
            let partners = 0;
            let sdg = 0;
            let other = 0;
            let totalAvailable = 0;
            let gap = 0;
            
            if (!isPerformanceMeasure && item.budget) {
              budgetRequired = item.budget.budget_calculation_type === 'WITH_TOOL' ? 
                Number(item.budget.estimated_cost_with_tool || 0) : 
                Number(item.budget.estimated_cost_without_tool || 0);
              
              government = Number(item.budget.government_treasury || 0);
              partners = Number(item.budget.partners_funding || 0);
              sdg = Number(item.budget.sdg_funding || 0);
              other = Number(item.budget.other_funding || 0);
              totalAvailable = government + partners + sdg + other;
              gap = Math.max(0, budgetRequired - totalAvailable);
            }
            
            // Calculate 6-month target (same logic as table)
            const sixMonthTarget = item.target_type === 'cumulative' 
              ? Number(item.q1_target || 0) + Number(item.q2_target || 0) 
              : Number(item.q2_target || 0);
            
            // Get selected months for each quarter
            const q1Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q1');
            const q2Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q2');
            const q3Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q3');
            const q4Months = getMonthsForQuarter(item.selected_months || [], item.selected_quarters || [], 'Q4');
            
            // Add prefix based on item type - SAME AS PLANREVIEWTABLE
            const displayName = isPerformanceMeasure 
              ? `PM: ${item.name}` 
              : `MA: ${item.name}`;
            
            exportData.push({
              No: objectiveAdded ? '' : (objIndex + 1).toString(),
              'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
              'Strategic Objective Weight': objectiveAdded ? '' : `${effectiveWeight}%`,
              'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
              'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
              'Performance Measure/Main Activity': displayName, // USING DISPLAY NAME WITH PREFIX
              'Weight': `${item.weight || 0}%`,
              'Baseline': item.baseline || '-',
              'Q1Target': item.q1_target || 0,
              'Q1Months': q1Months, // ACTUAL MONTHS FOR Q1
              'Q2Target': item.q2_target || 0,
              'Q2Months': q2Months, // ACTUAL MONTHS FOR Q2
              'SixMonthTarget': sixMonthTarget,
              'Q3Target': item.q3_target || 0,
              'Q3Months': q3Months, // ACTUAL MONTHS FOR Q3
              'Q4Target': item.q4_target || 0,
              'Q4Months': q4Months, // ACTUAL MONTHS FOR Q4
              'AnnualTarget': item.annual_target || 0,
              'Implementor': initiative.organization_name || 
                            (item.organization_name) ||
                            'Ministry of Health',
              'BudgetRequired': budgetRequired,
              'Government': government,
              'Partners': partners,
              'SDG': sdg,
              'Other': other,
              'TotalAvailable': totalAvailable,
              'Gap': gap
            });
            
            objectiveAdded = true;
            initiativeAddedForObjective = true;
          });
        }
      });
    }
  });
  
  // Calculate totals
  const grandTotalRequired = exportData.reduce((sum, row) => sum + (Number(row.BudgetRequired) || 0), 0);
  const grandTotalGovernment = exportData.reduce((sum, row) => sum + (Number(row.Government) || 0), 0);
  const grandTotalPartners = exportData.reduce((sum, row) => sum + (Number(row.Partners) || 0), 0);
  const grandTotalSDG = exportData.reduce((sum, row) => sum + (Number(row.SDG) || 0), 0);
  const grandTotalOther = exportData.reduce((sum, row) => sum + (Number(row.Other) || 0), 0);
  const grandTotalAvailable = grandTotalGovernment + grandTotalPartners + grandTotalSDG + grandTotalOther;
  const grandTotalGap = Math.max(0, grandTotalRequired - grandTotalAvailable);

  // Add summary row
  if (grandTotalRequired > 0) {
    exportData.push({
      'No': '',
      'Strategic Objective': 'TOTAL BUDGET SUMMARY',
      'Strategic Objective Weight': '',
      'Strategic Initiative': '',
      'Initiative Weight': '',
      'Performance Measure/Main Activity': '',
      'Weight': '',
      'Baseline': '',
      'Q1Target': '',
      'Q1Months': '',
      'Q2Target': '',
      'Q2Months': '',
      'SixMonthTarget': '',
      'Q3Target': '',
      'Q3Months': '',
      'Q4Target': '',
      'Q4Months': '',
      'AnnualTarget': '',
      'Implementor': '',
      'BudgetRequired': grandTotalRequired,
      'Government': grandTotalGovernment,
      'Partners': grandTotalPartners,
      'SDG': grandTotalSDG,
      'Other': grandTotalOther,
      'TotalAvailable': grandTotalAvailable,
      'Gap': grandTotalGap
    });

    // Add percentage row
    exportData.push({
      'No': '',
      'Strategic Objective': 'FUNDING BREAKDOWN',
      'Strategic Objective Weight': '',
      'Strategic Initiative': '',
      'Initiative Weight': '',
      'Performance Measure/Main Activity': '',
      'Weight': '',
      'Baseline': '',
      'Q1Target': '',
      'Q1Months': '',
      'Q2Target': '',
      'Q2Months': '',
      'SixMonthTarget': '',
      'Q3Target': '',
      'Q3Months': '',
      'Q4Target': '',
      'Q4Months': '',
      'AnnualTarget': '',
      'Implementor': '',
      'BudgetRequired': '100%',
      'Government': grandTotalAvailable > 0 ? `${((grandTotalGovernment / grandTotalAvailable) * 100).toFixed(1)}%` : '0%',
      'Partners': grandTotalAvailable > 0 ? `${((grandTotalPartners / grandTotalAvailable) * 100).toFixed(1)}%` : '0%',
      'SDG': grandTotalAvailable > 0 ? `${((grandTotalSDG / grandTotalAvailable) * 100).toFixed(1)}%` : '0%',
      'Other': grandTotalAvailable > 0 ? `${((grandTotalOther / grandTotalAvailable) * 100).toFixed(1)}%` : '0%',
      'TotalAvailable': '100%',
      'Gap': grandTotalGap > 0 ? `${((grandTotalGap / grandTotalRequired) * 100).toFixed(1)}%` : '0%'
    });
  }
  
  console.log(`Converted ${objectives.length} objectives to ${exportData.length} export rows`);
  return exportData;
};