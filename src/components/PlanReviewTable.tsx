import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, File as FilePdf, Send, AlertCircle, CheckCircle, DollarSign, Building2, Target, Activity, BarChart3, Info, Loader } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { organizations, auth, performanceMeasures, mainActivities, objectives, initiatives } from '../lib/api';
import type { StrategicObjective } from '../types/organization';
import type { PlanType } from '../types/plan';
import { exportToExcel, exportToPDF, processDataForExport } from '../lib/utils/export';

interface PlanReviewTableProps {
  objectives: StrategicObjective[];
  onSubmit: () => Promise<void>;
  isSubmitting: boolean;
  organizationName: string;
  plannerName: string;
  fromDate: string;
  toDate: string;
  planType: PlanType;
  isPreviewMode?: boolean;
  userOrgId?: number | null;
  isViewOnly?: boolean;
  planData?: any;
  refreshTrigger?: number; // Add refresh trigger prop
}

const PlanReviewTable: React.FC<PlanReviewTableProps> = ({
  objectives,
  onSubmit,
  isSubmitting,
  organizationName,
  plannerName,
  fromDate,
  toDate,
  planType,
  isPreviewMode = false,
  userOrgId = null,
  isViewOnly = false,
  planData = null,
  refreshTrigger = 0
}) => {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isSubmittingPlan, setIsSubmittingPlan] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [processedObjectives, setProcessedObjectives] = useState<StrategicObjective[]>([]);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [dataRefreshKey, setDataRefreshKey] = useState(0);
  const [isLoadingCompleteData, setIsLoadingCompleteData] = useState(true);

  // Determine the effective user organization ID
  const effectiveUserOrgId = userOrgId || planData?.organization || null;

  // Force data refresh whenever refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger > 0) {
      console.log('PlanReviewTable: Refresh triggered, invalidating all data');
      setDataRefreshKey(prev => prev + 1);
      
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['objectives'] });
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
    }
  }, [refreshTrigger, queryClient]);

  // Fetch fresh objectives data with all nested data
  const { data: freshObjectivesData, isLoading: isLoadingObjectives } = useQuery({
    queryKey: ['objectives-complete', effectiveUserOrgId, dataRefreshKey],
    queryFn: async () => {
      if (!effectiveUserOrgId) return [];
      
      console.log('PlanReviewTable: Fetching complete fresh objectives data');
      setIsLoadingCompleteData(true);
      
      try {
        // Get fresh objectives data
        const objectivesResponse = await objectives.getAll();
        const allObjectives = objectivesResponse?.data || [];
        
        // Filter to only selected objectives if provided
        const targetObjectives = (objectives && objectives.length > 0)
          ? allObjectives.filter(obj => (objectives || []).some(selected => selected.id === obj.id))
          : allObjectives;
        
        console.log(`Processing ${targetObjectives.length} objectives for complete data`);
        
        // For each objective, fetch all nested data
        const enrichedObjectives = await Promise.all(
          targetObjectives.map(async (objective) => {
            try {
              // Fetch initiatives for this objective
              const initiativesResponse = await initiatives.getByObjective(objective.id.toString());
              const allInitiatives = initiativesResponse?.data || [];
              
              // Filter initiatives by organization
              const userInitiatives = allInitiatives.filter(initiative => {
                const isDefault = initiative.is_default === true;
                const belongsToUserOrg = Number(initiative.organization) === Number(effectiveUserOrgId);
                const hasNoOrg = !initiative.organization;
                
                return isDefault || belongsToUserOrg || hasNoOrg;
              });
              
              console.log(`Objective ${objective.title}: ${userInitiatives.length} initiatives for user org`);
              
              // For each initiative, fetch measures and activities
              const enrichedInitiatives = await Promise.all(
                userInitiatives.map(async (initiative) => {
                  try {
                    // Fetch fresh performance measures
                    const measuresResponse = await performanceMeasures.getByInitiative(initiative.id);
                    const allMeasures = measuresResponse?.data || [];
                    const userMeasures = allMeasures.filter(measure => 
                      !measure.organization || Number(measure.organization) === Number(effectiveUserOrgId)
                    );
                    
                    // Fetch fresh main activities
                    const activitiesResponse = await mainActivities.getByInitiative(initiative.id);
                    const allActivities = activitiesResponse?.data || [];
                    const userActivities = allActivities.filter(activity => 
                      !activity.organization || Number(activity.organization) === Number(effectiveUserOrgId)
                    );
                    
                    console.log(`Initiative ${initiative.name}: ${userMeasures.length} measures, ${userActivities.length} activities`);
                    
                    return {
                      ...initiative,
                      performance_measures: userMeasures,
                      main_activities: userActivities
                    };
                  } catch (error) {
                    console.error(`Error fetching data for initiative ${initiative.id}:`, error);
                    return {
                      ...initiative,
                      performance_measures: [],
                      main_activities: []
                    };
                  }
                })
              );
              
              // Calculate effective weight
              const effectiveWeight = objective.planner_weight !== undefined && objective.planner_weight !== null
                ? objective.planner_weight
                : objective.weight;
              
              return {
                ...objective,
                effective_weight: effectiveWeight,
                initiatives: enrichedInitiatives
              };
            } catch (error) {
              console.error(`Error processing objective ${objective.id}:`, error);
              return {
                ...objective,
                effective_weight: objective.weight,
                initiatives: []
              };
            }
          })
        );
        
        console.log('PlanReviewTable: Successfully fetched complete fresh data');
        return enrichedObjectives;
      } catch (error) {
        console.error('PlanReviewTable: Error fetching complete data:', error);
        throw error;
      } finally {
        setIsLoadingCompleteData(false);
      }
    },
    enabled: !!effectiveUserOrgId,
    staleTime: 0, // Always fetch fresh data
    refetchOnWindowFocus: true,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: 2
  });

  // Update processed objectives when fresh data arrives
  useEffect(() => {
    if (freshObjectivesData && Array.isArray(freshObjectivesData)) {
      console.log('PlanReviewTable: Processing fresh objectives data:', freshObjectivesData.length);
      setProcessedObjectives(freshObjectivesData);
    }
  }, [freshObjectivesData]);

  // Manual refresh function for when data changes are detected
  const handleManualRefresh = async () => {
    console.log('PlanReviewTable: Manual refresh triggered');
    setIsRefreshingData(true);
    
    try {
      // Invalidate all caches and force refetch
      await queryClient.invalidateQueries({ queryKey: ['objectives-complete'] });
      await queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      await queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      await queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      
      // Increment refresh key to force new fetch
      setDataRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Manual refresh error:', error);
    } finally {
      setIsRefreshingData(false);
    }
  };

  // Auto-refresh when component mounts or dependencies change
  useEffect(() => {
    if (effectiveUserOrgId) {
      console.log('PlanReviewTable: Dependencies changed, triggering refresh');
      handleManualRefresh();
    }

  // Remove the old data fetching logic and replace with new comprehensive approach
  // Create a query key that includes all initiative IDs to fetch fresh data
  const allInitiativeIds = React.useMemo(() => {
    const ids: string[] = [];
    (objectives || []).forEach(objective => {
      (objective?.initiatives || []).forEach(initiative => {
        if (initiative.id) {
          ids.push(initiative.id);
        }
      });
    });
    return ids;
  }, [objectives]);
  
  // Process the fresh objectives data or use provided objectives
  useEffect(() => {
    if (freshObjectivesData && Array.isArray(freshObjectivesData) && freshObjectivesData.length > 0) {
      // Use the fresh comprehensive data from API
      console.log('PlanReviewTable: Using fresh objectives data:', freshObjectivesData.length);
      setProcessedObjectives(freshObjectivesData);
    } else if (objectives && Array.isArray(objectives) && objectives.length > 0) {
      // Fallback to provided objectives if fresh data not available yet
      console.log('PlanReviewTable: Using provided objectives as fallback:', objectives.length);
      setProcessedObjectives(objectives);
    } else {
      // No data available
      console.log('PlanReviewTable: No objectives data available');
      setProcessedObjectives([]);
    }

  // Fetch organizations for mapping names
  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        const response = await organizations.getAll();
        const orgMap: Record<string, string> = {};
        
        if (response && Array.isArray(response)) {
          response.forEach((org: any) => {
            if (org && org.id) {
              orgMap[org.id] = org.name;
            }
          });
        }
        
        setOrganizationsMap(orgMap);
      } catch (error) {
        console.error('Failed to fetch organizations:', error);
      }
    };
    
    fetchOrganizations();
  }, []);

  const formatCurrency = (amount: number): string => {
    return `$${amount.toLocaleString()}`;
  };

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (e) {
      return dateString;
    }
  };

  const calculateTotals = () => {
    let totalRequired = 0;
    let totalGovernment = 0;
    let totalPartners = 0;
    let totalSDG = 0;
    let totalOther = 0;

    processedObjectives.forEach(objective => {
      objective.initiatives?.forEach(initiative => {
        initiative.main_activities?.forEach(activity => {
          if (activity.budget) {
            const required = activity.budget.budget_calculation_type === 'WITH_TOOL' 
              ? Number(activity.budget.estimated_cost_with_tool || 0)
              : Number(activity.budget.estimated_cost_without_tool || 0);
            
            totalRequired += required;
            totalGovernment += Number(activity.budget.government_treasury || 0);
            totalPartners += Number(activity.budget.partners_funding || 0);
            totalSDG += Number(activity.budget.sdg_funding || 0);
            totalOther += Number(activity.budget.other_funding || 0);
          }
        });
      });
    });

    const totalAvailable = totalGovernment + totalPartners + totalSDG + totalOther;
    const totalGap = Math.max(0, totalRequired - totalAvailable);

    return {
      totalRequired,
      totalGovernment,
      totalPartners,
      totalSDG,
      totalOther,
      totalAvailable,
      totalGap
    };
  };

  const totals = calculateTotals();

  const handleSubmitPlan = async () => {
    setIsSubmittingPlan(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      await onSubmit();
      setSubmitSuccess('Plan submitted successfully!');
    } catch (error: any) {
      setSubmitError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmittingPlan(false);
    }
  };

  const handleExportExcel = () => {
    const exportData = processDataForExport(processedObjectives, 'en');
    exportToExcel(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  const handleExportPDF = () => {
    const exportData = processDataForExport(processedObjectives, 'en');
    exportToPDF(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: plannerName,
        fromDate: fromDate,
        toDate: toDate,
        planType: planType
      }
    );
  };

  // Show loading if no organization context
  if (!effectiveUserOrgId || isLoadingMeasures || isLoadingActivities || isRefreshingData) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span className="text-gray-600">
          {isRefreshingData ? 'Refreshing plan data...' : 
           isLoadingMeasures || isLoadingActivities ? 'Loading fresh data...' : 
           'Loading...'}
        </span>
      </div>
    );
  }

  // Show message if no objectives
  if (!processedObjectives || processedObjectives.length === 0) {
    return (
      <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Plan Data</h3>
        <p className="text-gray-500">No objectives or plan data available to display.</p>
      </div>
    );
  }

  // Convert processed objectives to table rows
  const tableRows: any[] = [];
  let rowNumber = 1;

  processedObjectives.forEach((objective, objIndex) => {
    const effectiveWeight = objective.effective_weight || objective.planner_weight || objective.weight;
    
    if (!objective.initiatives || objective.initiatives.length === 0) {
      // Objective with no initiatives
      tableRows.push({
        no: rowNumber++,
        objective: objective.title,
        objectiveWeight: `${effectiveWeight.toFixed(1)}%`,
        initiative: '-',
        initiativeWeight: '-',
        itemName: '-',
        itemType: 'Objective',
        itemWeight: '-',
        baseline: '-',
        q1Target: '-',
        q2Target: '-',
        sixMonthTarget: '-',
        q3Target: '-',
        q4Target: '-',
        annualTarget: '-',
        implementor: organizationName,
        budgetRequired: 0,
        government: 0,
        partners: 0,
        sdg: 0,
        other: 0,
        totalAvailable: 0,
        gap: 0
      });
      return;
    }

    let objectiveAdded = false;
    
    objective.initiatives.forEach((initiative, initIndex) => {
      const allItems = [
        ...(initiative.performance_measures || []).map(item => ({ ...item, type: 'Performance Measure' })),
        ...(initiative.main_activities || []).map(item => ({ ...item, type: 'Main Activity' }))
      ];

      if (allItems.length === 0) {
        // Initiative with no items
        tableRows.push({
          no: objectiveAdded ? '' : rowNumber++,
          objective: objectiveAdded ? '' : objective.title,
          objectiveWeight: objectiveAdded ? '' : `${effectiveWeight.toFixed(1)}%`,
          initiative: initiative.name,
          initiativeWeight: `${initiative.weight}%`,
          itemName: '-',
          itemType: 'Initiative',
          itemWeight: '-',
          baseline: '-',
          q1Target: '-',
          q2Target: '-',
          sixMonthTarget: '-',
          q3Target: '-',
          q4Target: '-',
          annualTarget: '-',
          implementor: initiative.organization_name || organizationsMap[initiative.organization] || organizationName,
          budgetRequired: 0,
          government: 0,
          partners: 0,
          sdg: 0,
          other: 0,
          totalAvailable: 0,
          gap: 0
        });
        objectiveAdded = true;
        return;
      }

      let initiativeAdded = false;

      allItems.forEach((item, itemIndex) => {
        // Determine if this item is a performance measure
        const isPerformanceMeasure = (initiative.performance_measures || []).some(pm => pm.id === item.id);
        
        // Calculate budget values for main activities
        let budgetRequired = 0;
        let government = 0;
        let partners = 0;
        let sdg = 0;
        let other = 0;
        let totalAvailable = 0;
        let gap = 0;

        if (item.type === 'Main Activity' && item.budget) {
          budgetRequired = item.budget.budget_calculation_type === 'WITH_TOOL' 
            ? Number(item.budget.estimated_cost_with_tool || 0)
            : Number(item.budget.estimated_cost_without_tool || 0);
          
          government = Number(item.budget.government_treasury || 0);
          partners = Number(item.budget.partners_funding || 0);
          sdg = Number(item.budget.sdg_funding || 0);
          other = Number(item.budget.other_funding || 0);
          totalAvailable = government + partners + sdg + other;
          gap = Math.max(0, budgetRequired - totalAvailable);
        }

        // Calculate 6-month target
        const sixMonthTarget = item.target_type === 'cumulative' 
          ? Number(item.q1_target || 0) + Number(item.q2_target || 0)
          : Number(item.q2_target || 0);

        // Add prefix to name based on type for clear identification
        const displayName = isPerformanceMeasure 
          ? `PM: ${item.name}` 
          : `MA: ${item.name}`;

        tableRows.push({
          no: objectiveAdded ? '' : (objIndex + 1),
          objective: objectiveAdded ? '' : objective.title,
          objectiveWeight: objectiveAdded ? '' : `${effectiveWeight.toFixed(1)}%`,
          initiative: initiativeAdded ? '' : initiative.name,
          initiativeWeight: initiativeAdded ? '' : `${initiative.weight}%`,
          itemName: displayName,
          itemType: item.type,
          itemWeight: `${item.weight}%`,
          baseline: item.baseline || '-',
          q1Target: item.q1_target || 0,
          q2Target: item.q2_target || 0,
          sixMonthTarget: sixMonthTarget,
          q3Target: item.q3_target || 0,
          q4Target: item.q4_target || 0,
          annualTarget: item.annual_target || 0,
          implementor: initiative.organization_name || organizationsMap[initiative.organization] || organizationName,
          budgetRequired,
          government,
          partners,
          sdg,
          other,
          totalAvailable,
          gap
        });

        objectiveAdded = true;
        initiativeAdded = true;
      });
    });
  });

  return (
    <div className="space-y-6">
      {/* Plan Header */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-gray-200">
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <Building2 className="h-6 w-6 mr-2 text-green-600" />
          {organizationName} - Strategic Plan
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Planner:</span>
            <div className="font-medium">{plannerName}</div>
          </div>
          <div>
            <span className="text-gray-500">Plan Type:</span>
            <div className="font-medium">{planType}</div>
          </div>
          <div>
            <span className="text-gray-500">From:</span>
            <div className="font-medium">{formatDate(fromDate)}</div>
          </div>
          <div>
            <span className="text-gray-500">To:</span>
            <div className="font-medium">{formatDate(toDate)}</div>
          </div>
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-gray-900">Complete Plan Details</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Excel
          </button>
          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FilePdf className="h-4 w-4 mr-2" />
            PDF
          </button>
        </div>
      </div>

      {/* Status Messages */}
      {submitError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      {submitSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center">
          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
          <p className="text-sm text-green-600">{submitSuccess}</p>
        </div>
      )}

      {/* Comprehensive Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gradient-to-r from-green-600 to-blue-600">
              <tr>
                <th className="px-4 py-5 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">No.</th>
                <th className="px-4 py-5 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Strategic Objective</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Obj Weight</th>
                <th className="px-4 py-5 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Strategic Initiative</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Init Weight</th>
                <th className="px-4 py-5 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">PM/MA Name</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Weight</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Baseline</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Q1 Target</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Q2 Target</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-blue-700 to-indigo-700">6-Month Target</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Q3 Target</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Q4 Target</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Annual Target</th>
                <th className="px-4 py-5 text-left text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg">Implementor</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-green-700 to-emerald-700">Budget Required</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-blue-600 to-blue-700">Government</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-purple-600 to-purple-700">Partners</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-green-600 to-green-700">SDG</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-orange-600 to-orange-700">Other</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider border-r border-white/30 shadow-lg bg-gradient-to-r from-blue-600 to-blue-700">Total Available</th>
                <th className="px-4 py-5 text-center text-xs font-bold text-white uppercase tracking-wider shadow-lg bg-gradient-to-r from-red-600 to-red-700">Gap</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tableRows.map((row, index) => (
                <tr key={index} className={`hover:bg-gray-50 ${
                  row.itemType === 'Performance Measure' ? 'bg-purple-50' : 
                  row.itemType === 'Main Activity' ? 'bg-green-50' : 
                  'bg-blue-50'
                }`}>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.no}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row.objective}>{row.objective}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {row.objectiveWeight && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {row.objectiveWeight}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                    <div className="truncate" title={row.initiative}>{row.initiative}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {row.initiativeWeight && row.initiativeWeight !== '-' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        {row.initiativeWeight}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 max-w-xs">
                    <div className="flex items-center">
                      {row.itemType === 'Performance Measure' && (
                        <BarChart3 className="h-4 w-4 text-purple-600 mr-2 flex-shrink-0" title="Performance Measure" />
                      )}
                      {row.itemType === 'Main Activity' && (
                        <Activity className="h-4 w-4 text-green-600 mr-2 flex-shrink-0" title="Main Activity" />
                      )}
                      <div className="truncate" title={row.displayName || row.itemName}>{row.displayName || row.itemName}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                    {row.itemWeight && row.itemWeight !== '-' && (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        row.itemType === 'Performance Measure' ? 'bg-purple-100 text-purple-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {row.itemWeight}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.baseline}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{row.q1Target}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{row.q2Target}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-blue-600">{row.sixMonthTarget}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{row.q3Target}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">{row.q4Target}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-gray-900">{row.annualTarget}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs">
                    <div className="truncate" title={row.implementor}>{row.implementor}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                    {row.budgetRequired > 0 ? formatCurrency(row.budgetRequired) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {row.government > 0 ? formatCurrency(row.government) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {row.partners > 0 ? formatCurrency(row.partners) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {row.sdg > 0 ? formatCurrency(row.sdg) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {row.other > 0 ? formatCurrency(row.other) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-blue-600">
                    {row.totalAvailable > 0 ? formatCurrency(row.totalAvailable) : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium">
                    {row.gap > 0 ? (
                      <span className="text-red-600">{formatCurrency(row.gap)}</span>
                    ) : row.budgetRequired > 0 ? (
                      <span className="text-green-600">Funded</span>
                    ) : '-'}
                  </td>
                </tr>
              ))}

              {/* Summary Row */}
              {totals.totalRequired > 0 && (
                <tr className="bg-blue-100 border-t-2 border-blue-300">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900" colSpan={15}>
                    TOTAL BUDGET SUMMARY
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-gray-900">
                    {formatCurrency(totals.totalRequired)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                    {formatCurrency(totals.totalGovernment)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-purple-600">
                    {formatCurrency(totals.totalPartners)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-green-600">
                    {formatCurrency(totals.totalSDG)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-orange-600">
                    {formatCurrency(totals.totalOther)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold text-blue-600">
                    {formatCurrency(totals.totalAvailable)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-bold">
                    {totals.totalGap > 0 ? (
                      <span className="text-red-600">{formatCurrency(totals.totalGap)}</span>
                    ) : (
                      <span className="text-green-600">Fully Funded</span>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Budget Summary Cards */}
      {totals.totalRequired > 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-green-600" />
            Budget Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Required</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(totals.totalRequired)}</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Available</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totals.totalAvailable)}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Government</div>
              <div className="text-xl font-bold text-blue-600">{formatCurrency(totals.totalGovernment)}</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Partners</div>
              <div className="text-xl font-bold text-purple-600">{formatCurrency(totals.totalPartners)}</div>
            </div>
          </div>
          
          {totals.totalGap > 0 && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                <span className="text-sm font-medium text-red-700">
                  Funding Gap: {formatCurrency(totals.totalGap)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Submit Button - Only show if not preview mode and not view only */}
      {!isPreviewMode && !isViewOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmitPlan}
            disabled={isSubmitting || isSubmittingPlan}
            className="inline-flex items-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
          >
            {isSubmitting || isSubmittingPlan ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Submit Plan for Review
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default PlanReviewTable;