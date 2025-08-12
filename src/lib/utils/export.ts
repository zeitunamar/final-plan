import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { MONTHS } from '../../types/plan';
import type { StrategicObjective } from '../../types/organization';
import type { Language } from '../i18n/translations';

// Helper function to get selected months for a specific quarter
const getMonthsForQuarter = (selectedMonths: string[] | null, selectedQuarters: string[] | null, quarter: 'Q1' | 'Q2' | 'Q3' | 'Q4'): string => {
  console.log(`Getting months for ${quarter}:`, { selectedMonths, selectedQuarters });
  
  if (!selectedMonths && !selectedQuarters) {
    console.log(`No months or quarters selected for ${quarter}`);
    return '-';
  }
  
  // If quarters are selected, show all months in that quarter
  if (selectedQuarters && Array.isArray(selectedQuarters) && selectedQuarters.includes(quarter)) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter)
      .map(month => month.value);
    console.log(`Quarter ${quarter} selected, showing all months:`, quarterMonths);
    return quarterMonths.join(', ');
  }
  
  // If individual months are selected, show only selected months for that quarter
  if (selectedMonths && Array.isArray(selectedMonths) && selectedMonths.length > 0) {
    const quarterMonths = MONTHS
      .filter(month => month.quarter === quarter && selectedMonths.includes(month.value))
      .map(month => month.value);
    console.log(`Individual months selected for ${quarter}:`, quarterMonths);
    return quarterMonths.length > 0 ? quarterMonths.join(', ') : '-';
  }
  
  console.log(`No valid selection for ${quarter}`);
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
  'Q1Target',
  'Q1Months',
  'Q2Target',
  'Q2Months',
  'SixMonthTarget',
  'Q3Target',
  'Q3Months',
  'Q4Target',
  'Q4Months',
  'AnnualTarget',
  'Implementor',
  'BudgetRequired',
  'Government',
  'Partners',
  'SDG',
  'Other',
  'TotalAvailable',
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

const formatCurrency = (amount: number | string | undefined): string => {
  if (amount === undefined || amount === null || amount === '') return '$0';
  const numValue = typeof amount === 'string' ? parseFloat(value) : amount;
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
    console.log('Starting Excel export with data rows:', data.length);
    
    const workbook = XLSX.utils.book_new();
    
    // Select headers based on language
    const headers = language === 'am' ? TABLE_HEADERS_AM : TABLE_HEADERS_EN;
    
    // Transform data to match table structure with all 26 columns
    const tableData = data.map((row, index) => {
      console.log(`Processing Excel row ${index + 1}:`, row);
      
      return [
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
      ];
    });

    console.log(`Converted ${data.length} data rows to ${tableData.length} Excel table rows`);

    // Create worksheet with headers and data
    const worksheetData = [headers, ...tableData];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

    // Auto-size columns
    const columnWidths = headers.map((header, colIndex) => {
      const maxLength = Math.max(
        header.length,
        ...tableData.map(row => String(row[colIndex] || '').length)
      );
      return { wch: Math.min(Math.max(maxLength + 2, 10), 30) };
    });
    worksheet['!cols'] = columnWidths;

    // Style the header row
    const headerRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
      if (!worksheet[cellAddress]) continue;
      
      worksheet[cellAddress].s = {
        fill: { fgColor: { rgb: "4F46E5" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

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
    
    console.log('Excel export completed, saving file:', `${filename}.xlsx`);
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
    console.log('Starting PDF export with data rows:', data.length);
    
    const doc = new jsPDF('l', 'mm', 'a4'); // Landscape orientation
    
    // Select headers based on language
    const headers = language === 'am' ? TABLE_HEADERS_AM : TABLE_HEADERS_EN;
    
    // Transform data to match table structure
    const tableData = data.map((row, index) => {
      console.log(`PDF Processing row ${index + 1}:`, row);
      
      return [
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
      ];
    });

    console.log(`Converted ${data.length} data rows to ${tableData.length} PDF table rows`);

    // Add title and metadata
    if (metadata) {
      doc.setFontSize(16);
      doc.text(`${metadata.organization || 'Ministry of Health'} - Strategic Plan`, 20, 20);
      
      doc.setFontSize(12);
      doc.text(`Planner: ${metadata.planner || 'N/A'}`, 20, 30);
      doc.text(`Plan Type: ${metadata.planType || 'N/A'}`, 20, 40);
      doc.text(`Period: ${metadata.fromDate || 'N/A'} - ${metadata.toDate || 'N/A'}`, 20, 50);
    }

    // Add table with all data
    (doc as any).autoTable({
      head: [headers],
      body: tableData,
      startY: metadata ? 60 : 20,
      styles: {
        fontSize: 6,
        cellPadding: 1,
        lineWidth: 0.1,
        lineColor: [200, 200, 200]
      },
      headStyles: {
        fillColor: [79, 70, 229],
        textColor: 255,
        fontSize: 7,
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 25, halign: 'left' },
        2: { cellWidth: 12, halign: 'center' },
        3: { cellWidth: 25, halign: 'left' },
        4: { cellWidth: 12, halign: 'center' },
        5: { cellWidth: 30, halign: 'left' },
        6: { cellWidth: 10, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' },
        8: { cellWidth: 20, halign: 'center' },
        9: { cellWidth: 20, halign: 'center' },
        10: { cellWidth: 15, halign: 'center' },
        11: { cellWidth: 20, halign: 'center' },
        12: { cellWidth: 15, halign: 'center' },
        13: { cellWidth: 20, halign: 'center' },
        14: { cellWidth: 15, halign: 'center' },
        15: { cellWidth: 18, halign: 'right' },
        16: { cellWidth: 15, halign: 'right' },
        17: { cellWidth: 15, halign: 'right' },
        18: { cellWidth: 12, halign: 'right' },
        19: { cellWidth: 12, halign: 'right' },
        20: { cellWidth: 18, halign: 'right' },
        21: { cellWidth: 15, halign: 'right' }
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      }
    });

    console.log('PDF export completed, saving file:', `${filename}.pdf`);
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

  console.log(`Converting ${objectives.length} objectives for export`);

  objectives.forEach((objective, objIndex) => {
    if (!objective) return;
    
    // Get objective weight directly from database (effective_weight, planner_weight, or weight)
    const objectiveWeight = objective.effective_weight || objective.planner_weight || objective.weight;
    
    let objectiveAdded = false;
    
    if (!objective.initiatives || objective.initiatives.length === 0) {
      // Objective with no initiatives
      exportData.push({
        No: objIndex + 1,
        'Strategic Objective': objective.title || 'Untitled Objective',
        'Strategic Objective Weight': `${objectiveWeight.toFixed(1)}%`,
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
        
        const performanceMeasures = (initiative.performance_measures || []).map(item => ({ ...item, type: 'Performance Measure' }));
        const mainActivities = (initiative.main_activities || []).map(item => ({ ...item, type: 'Main Activity' }));
        
        const allItems = [...performanceMeasures, ...mainActivities];
        
        if (allItems.length === 0) {
          // Initiative with no measures or activities
          exportData.push({
            No: objectiveAdded ? '' : (objIndex + 1).toString(),
            'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
            'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight.toFixed(1)}%`,
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

            // Add prefix based on item type
            const displayName = isPerformanceMeasure 
              ? `PM: ${item.name}` 
              : `MA: ${item.name}`;
            
            exportData.push({
              No: objectiveAdded ? '' : (objIndex + 1).toString(),
              'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
              'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight.toFixed(1)}%`,
              'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
              'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
              'Performance Measure/Main Activity': displayName,
              'Weight': `${item.weight || 0}%`,
              'Baseline': item.baseline || '-',
              'Q1Target': item.q1_target || 0,
              'Q1Months': q1Months,
              'Q2Target': item.q2_target || 0,
              'Q2Months': q2Months,
              'SixMonthTarget': sixMonthTarget,
              'Q3Target': item.q3_target || 0,
              'Q3Months': q3Months,
              'Q4Target': item.q4_target || 0,
              'Q4Months': q4Months,
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
  
  console.log(`Converted ${objectives.length} objectives to ${exportData.length} export rows`);
  return exportData;
};