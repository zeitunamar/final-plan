import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { Download, FileSpreadsheet, File as FilePdf, ArrowLeft, AlertCircle, Loader, Building2, Calendar, User, CheckCircle, XCircle, ClipboardCheck, FileType, RefreshCw } from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { plans, organizations, auth, api } from '../lib/api';
import { format } from 'date-fns';
import { exportToExcel, exportToPDF } from '../lib/utils/export';
import PlanReviewForm from '../components/PlanReviewForm';
import PlanReviewTable from '../components/PlanReviewTable';
import { isAdmin, isEvaluator, isPlanner } from '../types/user';
import Cookies from 'js-cookie';
import axios from 'axios';

const PlanSummary: React.FC = () => {
  // All hooks must be called unconditionally at the top level
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { planId } = useParams();

  // State hooks
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userOrganizations, setUserOrganizations] = useState<number[]>([]);
  const [authState, setAuthState] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationName, setOrganizationName] = useState<string>('');
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [processedPlanData, setProcessedPlanData] = useState<any>(null);

  // Add organizations mapping for implementer display
  const [organizationsMap, setOrganizationsMap] = useState<Record<string, string>>({});
  const [plannerOrgId, setPlannerOrgId] = useState<number | null>(null);

  // Query hooks
  const { data: organizationsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: async () => {
      try {
        const response = await organizations.getAll();
        return response || [];
      } catch (error) {
        console.error("Failed to fetch organizations:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: planData, isLoading, error, refetch } = useQuery({
    queryKey: ['plan', planId, retryCount],
    queryFn: async () => {
      if (!planId) throw new Error("Plan ID is missing");
      
      try {
        await auth.getCurrentUser();
        const timestamp = new Date().getTime();
        
        try {
          const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-CSRFToken': Cookies.get('csrftoken') || '',
            'Accept': 'application/json'
          };
          
          const response = await axios.get(`/api/plans/${planId}/?_=${timestamp}`, { 
            headers,
            withCredentials: true,
            timeout: 10000
          });
          
          if (!response.data) throw new Error("No data received");
          return normalizeAndProcessPlanData(response.data);
        } catch (directError) {
          const planResult = await plans.getById(planId);
          if (!planResult) throw new Error("No data received");
          return planResult;
        }
      } catch (error: any) {
        setLoadingError(error.message || "Failed to load plan");
        throw error;
      }
    },
    retry: 2,
    retryDelay: 1000,
    refetchOnWindowFocus: false,
    staleTime: 0,
    enabled: !!authState && !!planId
  });

  const reviewPlanMutation = useMutation({
    mutationFn: async (data: { status: 'APPROVED' | 'REJECTED', feedback: string }) => {
      if (!planId) throw new Error("Plan ID is missing");

      await auth.getCurrentUser();
      await axios.get('/api/auth/csrf/', { withCredentials: true });
      
      const timestamp = new Date().getTime();
      
      if (data.status === 'APPROVED') {
        return api.post(`/plans/${planId}/approve/?_=${timestamp}`, { feedback: data.feedback });
      } else {
        return api.post(`/plans/${planId}/reject/?_=${timestamp}`, { feedback: data.feedback });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans', 'pending-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      setShowReviewForm(false);
      navigate('/evaluator');
    },
    onError: (error: any) => {
      setLoadingError(error.message || 'Failed to submit review');
    }
  });

  // Authentication effect
  useEffect(() => {
    const ensureAuth = async () => {
      try {
        const authData = await auth.getCurrentUser();
        if (!authData) {
          navigate('/login');
          return;
        }
        
        setAuthState(authData);
        
        if (authData.userOrganizations?.length > 0) {
          setUserRole(authData.userOrganizations[0].role);
          setUserOrganizations(authData.userOrganizations.map(org => org.organization));
          setPlannerOrgId(authData.userOrganizations[0].organization);
        }
        
        const response = await axios.get('/api/auth/csrf/', { withCredentials: true });
        const token = response.headers['x-csrftoken'] || Cookies.get('csrftoken');
        if (token) Cookies.set('csrftoken', token, { path: '/' });
      } catch (error) {
        console.error("Authentication check failed:", error);
      }
    };
    
    ensureAuth();
  }, [navigate]);

  useEffect(() => {
    // Create organizations mapping
    if (organizationsData) {
      const orgMap: Record<string, string> = {};
      
      const orgsArray = Array.isArray(organizationsData) ? organizationsData : organizationsData.data || [];
      if (Array.isArray(orgsArray)) {
        orgsArray.forEach((org: any) => {
          if (org && org.id) {
            orgMap[org.id] = org.name;
          }
        });
      }
      
      setOrganizationsMap(orgMap);
      console.log('Organizations map created for plan summary:', orgMap);
    }
    
    if (planData) {
      setProcessedPlanData(planData);
      
      if (organizationsData) {
        try {
          if (planData.organizationName) {
            setOrganizationName(planData.organizationName);
            return;
          }
          
          if (planData.organization) {
            const org = Array.isArray(organizationsData) 
              ? organizationsData.find(o => o.id.toString() === planData.organization.toString())
              : organizationsData.data?.find(o => o.id.toString() === planData.organization.toString());
            
            if (org) {
              setOrganizationName(org.name);
              return;
            }
          }
          
          setOrganizationName('Unknown Organization');
        } catch (e) {
          setOrganizationName('Unknown Organization');
        }
      }
    }
  }, [planData, organizationsData]);

  // Helper functions
  const normalizeAndProcessPlanData = (plan: any) => {
    if (!plan) return plan;
    
    const processedPlan = JSON.parse(JSON.stringify(plan));
    
    try {
      // Ensure all expected arrays exist and are properly formatted
      if (!Array.isArray(processedPlan.objectives)) {
        processedPlan.objectives = processedPlan.objectives 
          ? (Array.isArray(processedPlan.objectives) ? processedPlan.objectives : [processedPlan.objectives])
          : [];
      }

      processedPlan.objectives = processedPlan.objectives.map((objective: any) => {
        if (!objective) return objective;
        
        objective.initiatives = Array.isArray(objective.initiatives) 
          ? objective.initiatives 
          : (objective.initiatives ? [objective.initiatives] : []);
        
        objective.initiatives = objective.initiatives.map((initiative: any) => {
          if (!initiative) return initiative;
          
          initiative.performance_measures = Array.isArray(initiative.performance_measures)
            ? initiative.performance_measures
            : (initiative.performance_measures ? [initiative.performance_measures] : []);
          
          initiative.main_activities = Array.isArray(initiative.main_activities)
            ? initiative.main_activities
            : (initiative.main_activities ? [initiative.main_activities] : []);
          
          initiative.main_activities = initiative.main_activities.map((activity: any) => {
            if (!activity) return activity;
            
            activity.selected_months = Array.isArray(activity.selected_months)
              ? activity.selected_months
              : (activity.selected_months ? [activity.selected_months] : []);
            
            activity.selected_quarters = Array.isArray(activity.selected_quarters)
              ? activity.selected_quarters
              : (activity.selected_quarters ? [activity.selected_quarters] : []);
            
            return activity;
          });
          
          return initiative;
        });
        
        return objective;
      });

      processedPlan.reviews = Array.isArray(processedPlan.reviews)
        ? processedPlan.reviews
        : (processedPlan.reviews ? [processedPlan.reviews] : []);
        
    } catch (e) {
      console.error('Error normalizing plan data:', e);
    }
    
    return processedPlan;
  };

  const calculateTotalBudget = () => {
    let total = 0;
    let governmentTotal = 0;
    let sdgTotal = 0;
    let partnersTotal = 0;
    let otherTotal = 0;

    if (!processedPlanData?.objectives) {
      return { total, governmentTotal, sdgTotal, partnersTotal, otherTotal };
    }

    try {
      processedPlanData.objectives.forEach((objective: any) => {
        objective?.initiatives?.forEach((initiative: any) => {
          initiative?.main_activities?.forEach((activity: any) => {
            let activityBudgetRequired = 0;
            let activityGovernment = 0;
            let activityPartners = 0;
            let activitySdg = 0;
            let activityOther = 0;
            
            // Calculate budget from sub-activities if they exist
            if (activity.sub_activities && activity.sub_activities.length > 0) {
              activity.sub_activities.forEach((subActivity: any) => {
                // Use direct SubActivity model fields
                const subCost = subActivity.budget_calculation_type === 'WITH_TOOL'
                  ? Number(subActivity.estimated_cost_with_tool || 0)
                  : Number(subActivity.estimated_cost_without_tool || 0);
                
                activityBudgetRequired += subCost;
                activityGovernment += Number(subActivity.government_treasury || 0);
                activityPartners += Number(subActivity.partners_funding || 0);
                activitySdg += Number(subActivity.sdg_funding || 0);
                activityOther += Number(subActivity.other_funding || 0);
              });
            } else if (activity.budget) {
              // Use legacy budget if no sub-activities
              activityBudgetRequired = activity.budget.budget_calculation_type === 'WITH_TOOL' 
                ? Number(activity.budget.estimated_cost_with_tool || 0) 
                : Number(activity.budget.estimated_cost_without_tool || 0);
              
              activityGovernment = Number(activity.budget.government_treasury || 0);
              activityPartners = Number(activity.budget.partners_funding || 0);
              activitySdg = Number(activity.budget.sdg_funding || 0);
              activityOther = Number(activity.budget.other_funding || 0);
            }
            
            // Add to overall totals
            total += activityBudgetRequired;
            governmentTotal += activityGovernment;
            sdgTotal += activitySdg;
            partnersTotal += activityPartners;
            otherTotal += activityOther;
          });
        });
      });
    } catch (e) {
      console.error('Error calculating total budget:', e);
    }

    return { total, governmentTotal, sdgTotal, partnersTotal, otherTotal };
  };

  const budgetTotals = calculateTotalBudget();

  // Convert plan data to export format (same as PlanReviewTable displays)
  const convertPlanDataToExportFormat = (objectives: any[]) => {
    const exportData: any[] = [];
    
    if (!objectives || !Array.isArray(objectives)) {
      console.warn('No objectives to export');
      return exportData;
    }

    const userOrgId = userOrganizations?.[0] || null;
    console.log('Converting plan data for export - user org:', userOrgId);
    console.log('Objectives to convert:', objectives.length);

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
          'Q2Target': '-',
          'SixMonthTarget': '-',
          'Q3Target': '-',
          'Q4Target': '-',
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
        // Filter initiatives to only show user's organization data
        const userInitiatives = objective.initiatives.filter(initiative => 
          initiative.is_default || 
          !initiative.organization || 
          initiative.organization === userOrgId
        );
        
        console.log(`Objective ${objective.title}: ${objective.initiatives.length} total initiatives, ${userInitiatives.length} for user org`);
        
        userInitiatives.forEach((initiative: any) => {
          if (!initiative) return;
          
          // Filter performance measures and main activities by organization
          const performanceMeasures = (initiative.performance_measures || []).filter(measure =>
            !measure.organization || measure.organization === userOrgId
          );
          const mainActivities = (initiative.main_activities || []).filter(activity =>
            !activity.organization || activity.organization === userOrgId
          );
          
          console.log(`Initiative ${initiative.name}: ${performanceMeasures.length} measures, ${mainActivities.length} activities for user org`);
          
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
              'Q2Target': '-',
              'SixMonthTarget': '-',
              'Q3Target': '-',
              'Q4Target': '-',
              'AnnualTarget': '-',
              'Implementor': initiative.organization_name || 
                            (initiative.organization && organizationsMap && organizationsMap[initiative.organization]) ||
                            'Ministry of Health',
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
              
              const isPerformanceMeasure = performanceMeasures.includes(item);
              
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
              
              exportData.push({
                No: objectiveAdded ? '' : (objIndex + 1).toString(),
                'Strategic Objective': objectiveAdded ? '' : (objective.title || 'Untitled Objective'),
                'Strategic Objective Weight': objectiveAdded ? '' : `${objectiveWeight.toFixed(1)}%`,
                'Strategic Initiative': initiativeAddedForObjective ? '' : (initiative.name || 'Untitled Initiative'),
                'Initiative Weight': initiativeAddedForObjective ? '' : `${initiative.weight || 0}%`,
                'Performance Measure/Main Activity': item.name || 'Untitled Item',
                'Weight': `${item.weight || 0}%`,
                'Baseline': item.baseline || '-',
                'Q1Target': item.q1_target || 0,
                'Q2Target': item.q2_target || 0,
                'SixMonthTarget': sixMonthTarget,
                'Q3Target': item.q3_target || 0,
                'Q4Target': item.q4_target || 0,
                'AnnualTarget': item.annual_target || 0,
                'Implementor': initiative.organization_name || 
                              (initiative.organization && organizationsMap && organizationsMap[initiative.organization]) ||
                              (item.organization_name) ||
                              (item.organization && organizationsMap && organizationsMap[item.organization]) ||
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
  
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return 'N/A';
    try {
      return format(new Date(dateString), 'PP');
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getPeriodString = (activity: any) => {
    if (!activity) return 'N/A';
    
    try {
      if (activity.selected_quarters?.length > 0) {
        return activity.selected_quarters.join(', ');
      } 
      if (activity.selected_months?.length > 0) {
        return activity.selected_months.join(', ');
      }
    } catch (e) {
      console.error('Error getting period string:', e);
    }
    
    return 'N/A';
  };

  const getPlanTypeDisplay = (type: string) => type || 'N/A';

  // Event handlers
  const handleRetry = async () => {
    setLoadingError(null);
    setRetryCount(prev => prev + 1);
    try {
      await auth.getCurrentUser();
      await refetch();
    } catch (error) {
      setLoadingError("Failed to reload plan");
    }
  };

  const handleRefresh = async () => {
    setLoadingError(null);
    setRetryCount(prev => prev + 1);
    try {
      await auth.getCurrentUser();
      await refetch();
    } catch (error) {
      console.error("Refresh failed:", error);
    }
  };

  const handleApprove = async () => {
    try {
      await auth.getCurrentUser();
      setShowReviewForm(true);
    } catch (error) {
      setLoadingError('Authentication error');
    }
  };

  const handleReviewSubmit = async (data: { status: 'APPROVED' | 'REJECTED'; feedback: string }) => {
    if (!planId) return;
    
    setIsSubmitting(true);
    try {
      await reviewPlanMutation.mutateAsync(data);
    } catch (error: any) {
      setLoadingError(error.message || 'Failed to submit review');
      setIsSubmitting(false);
      setShowReviewForm(false);
    }
  };

  const handleExportExcel = () => {
    if (!processedPlanData?.objectives) {
      console.error('No objectives data available for export');
      return;
    }
    
    console.log('Exporting plan data:', processedPlanData.objectives);
    
    try {
      // CRITICAL FIX: Filter objectives data before conversion to ensure only user org data
      const filteredObjectivesForExport = processedPlanData.objectives?.map(objective => {
        if (!objective.initiatives) return objective;
        
        // Filter initiatives to only include planner's organization or defaults
        const userInitiatives = objective.initiatives.filter(initiative => {
          const isDefault = initiative.is_default === true;
          const belongsToUserOrg = initiative.organization === plannerOrgId;
          const shouldInclude = isDefault || belongsToUserOrg;
          
          console.log(`Export filter - Initiative "${initiative.name}": isDefault=${isDefault}, org=${initiative.organization}, userOrg=${plannerOrgId}, shouldInclude=${shouldInclude}`);
          
          return shouldInclude;
        });
        
        // For each initiative, filter measures and activities
        const filteredInitiatives = userInitiatives.map(initiative => {
          const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
            return measure.organization === plannerOrgId || !measure.organization;
          });
          
          const filteredActivities = (initiative.main_activities || []).filter(activity => {
            return activity.organization === plannerOrgId || !activity.organization;
          });
          
          return {
            ...initiative,
            performance_measures: filteredMeasures,
            main_activities: filteredActivities
          };
        });
        
        return {
          ...objective,
          initiatives: filteredInitiatives
        };
      }) || [];
      
      console.log('Filtered objectives for export:', filteredObjectivesForExport.length);
      
      // Convert filtered plan data to export format
      const exportData = convertPlanDataToExportFormat(filteredObjectivesForExport);
      
      exportToExcel(
        exportData,
        `plan-${new Date().toISOString().slice(0, 10)}`,
        'en',
        {
          organization: organizationName,
          planner: processedPlanData.planner_name || 'N/A',
          fromDate: processedPlanData.from_date || 'N/A',
          toDate: processedPlanData.to_date || 'N/A',
          planType: processedPlanData.type || 'N/A'
        }
      );
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const handleExportPDF = () => {
    if (!processedPlanData?.objectives) return;
    
    // CRITICAL FIX: Filter objectives data before PDF export to ensure only user org data
    const filteredObjectivesForPDF = processedPlanData.objectives?.map(objective => {
      if (!objective.initiatives) return objective;
      
      // Filter initiatives to only include planner's organization or defaults
      const userInitiatives = objective.initiatives.filter(initiative => {
        const isDefault = initiative.is_default === true;
        const belongsToUserOrg = initiative.organization === plannerOrgId;
        return isDefault || belongsToUserOrg;
      });
      
      // For each initiative, filter measures and activities
      const filteredInitiatives = userInitiatives.map(initiative => {
        const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
          return measure.organization === plannerOrgId || !measure.organization;
        });
        
        const filteredActivities = (initiative.main_activities || []).filter(activity => {
          return activity.organization === plannerOrgId || !activity.organization;
        });
        
        return {
          ...initiative,
          performance_measures: filteredMeasures,
          main_activities: filteredActivities
        };
      });
      
      return {
        ...objective,
        initiatives: filteredInitiatives
      };
    }) || [];
    
    const exportData = convertPlanDataToExportFormat(filteredObjectivesForPDF);
    
    exportToPDF(
      exportData,
      `plan-${new Date().toISOString().slice(0, 10)}`,
      'en',
      {
        organization: organizationName,
        planner: processedPlanData.planner_name || 'N/A',
        fromDate: processedPlanData.from_date || 'N/A',
        toDate: processedPlanData.to_date || 'N/A',
        planType: processedPlanData.type || 'N/A'
      }
    );
  };

  // Render conditions
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader className="h-6 w-6 animate-spin mr-2 text-green-600" />
        <span className="text-lg">Loading plan details...</span>
      </div>
    );
  }

  if (error || loadingError) {
    const errorMessage = loadingError || (error instanceof Error ? error.message : "An unknown error occurred");
    
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-lg text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800">Failed to load plan</h3>
        <p className="text-red-600 mt-2">{errorMessage}</p>
        <div className="mt-6 flex justify-center space-x-4">
          <button
            onClick={handleRetry}
            className="px-4 py-2 bg-white border border-red-300 rounded-md text-red-700 hover:bg-red-50"
          >
            Try Again
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!processedPlanData) {
    return (
      <div className="p-8 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-yellow-800">Plan Not Found</h3>
        <p className="text-yellow-600 mt-2">The requested plan could not be found.</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-6 px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Go Back
        </button>
      </div>
    );
  }

  // CRITICAL FIX: Enhanced filtering function to ensure ONLY planner organization data
  const getFilteredPlanData = () => {
    if (!processedPlanData?.objectives || !plannerOrgId) {
      return processedPlanData;
    }
    
    console.log('Filtering plan data for planner organization:', plannerOrgId);
    
    const filteredObjectives = processedPlanData.objectives.map(objective => {
      if (!objective.initiatives) return objective;
      
      // STRICT FILTERING: Only include default initiatives OR initiatives from planner's organization
      const userInitiatives = objective.initiatives.filter(initiative => {
        const isDefault = initiative.is_default === true;
        const belongsToUserOrg = initiative.organization === plannerOrgId;
        const hasNoOrg = !initiative.organization; // Legacy data
        const shouldInclude = isDefault || belongsToUserOrg;
        
        console.log(`Plan view filter - Initiative "${initiative.name}": isDefault=${isDefault}, org=${initiative.organization}, plannerOrg=${plannerOrgId}, shouldInclude=${shouldInclude}`);
        
        return shouldInclude;
      });
      
      // For each initiative, filter measures and activities by planner organization
      const filteredInitiatives = userInitiatives.map(initiative => {
        const filteredMeasures = (initiative.performance_measures || []).filter(measure => {
          const belongsToUserOrg = measure.organization === plannerOrgId;
          const hasNoOrg = !measure.organization;
          const shouldInclude = belongsToUserOrg || hasNoOrg;
          
          console.log(`Measure "${measure.name}": org=${measure.organization}, plannerOrg=${plannerOrgId}, shouldInclude=${shouldInclude}`);
          return shouldInclude;
        });
        
        const filteredActivities = (initiative.main_activities || []).filter(activity => {
          const belongsToUserOrg = activity.organization === plannerOrgId;
          const hasNoOrg = !activity.organization;
          const shouldInclude = belongsToUserOrg || hasNoOrg;
          
          console.log(`Activity "${activity.name}": org=${activity.organization}, plannerOrg=${plannerOrgId}, shouldInclude=${shouldInclude}`);
          return shouldInclude;
        });
        
        return {
          ...initiative,
          performance_measures: filteredMeasures,
          main_activities: filteredActivities
        };
      });
      
      return {
        ...objective,
        initiatives: filteredInitiatives
      };
    });
    
    return {
      ...processedPlanData,
      objectives: filteredObjectives
    };
  };
  
  // Get filtered plan data for display
  const filteredPlanData = getFilteredPlanData();
  
  // Main render
  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-5 w-5 mr-1" />
          Back
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Plan Details</h1>
            <div className="flex items-center mt-1">
              <div className={`px-2 py-1 text-xs rounded ${
                filteredPlanData.status === 'DRAFT' ? 'bg-gray-100 text-gray-800' :
                filteredPlanData.status === 'SUBMITTED' ? 'bg-yellow-100 text-yellow-800' :
                filteredPlanData.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {filteredPlanData.status}
              </div>
              {filteredPlanData.submitted_at && (
                <span className="ml-2 text-sm text-gray-500">
                  Submitted on {formatDate(filteredPlanData.submitted_at)}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleExportExcel}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export Excel
            </button>
            
            {filteredPlanData.status === 'SUBMITTED' && (
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 flex items-center"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </button>
            )}
            
            {filteredPlanData.status === 'SUBMITTED' && isEvaluator(authState?.userOrganizations) && (
              <button
                onClick={handleApprove}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                <ClipboardCheck className="h-4 w-4 mr-2" />
                Review Plan
              </button>
            )}
          </div>
        </div>

        {/* Move Evaluator Feedback to top - before the table */}
        {filteredPlanData.reviews?.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Evaluator Feedback</h2>
            <div className={`p-4 rounded-lg ${
              filteredPlanData.status === 'APPROVED' ? 'bg-green-50 border border-green-200' : 
              filteredPlanData.status === 'REJECTED' ? 'bg-red-50 border border-red-200' : 
              'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-start">
                {filteredPlanData.status === 'APPROVED' ? (
                  <CheckCircle className="h-5 w-5 mr-2 text-green-500 mt-0.5" />
                ) : filteredPlanData.status === 'REJECTED' ? (
                  <XCircle className="h-5 w-5 mr-2 text-red-500 mt-0.5" />
                ) : (
                  <div className="h-5 w-5 mr-2" />
                )}
                <div>
                  <p className={`font-medium ${
                    filteredPlanData.status === 'APPROVED' ? 'text-green-700' : 
                    filteredPlanData.status === 'REJECTED' ? 'text-red-700' : 
                    'text-gray-700'
                  }`}>
                    {filteredPlanData.status === 'APPROVED' ? 'Plan Approved' : 
                     filteredPlanData.status === 'REJECTED' ? 'Plan Rejected' :
                     'Pending Review'}
                  </p>
                  {filteredPlanData.reviews[0]?.feedback && (
                    <p className="mt-1 text-gray-600">
                      {filteredPlanData.reviews[0].feedback}
                    </p>
                  )}
                  {filteredPlanData.reviews[0]?.reviewed_at && (
                    <p className="mt-2 text-sm text-gray-500">
                      Reviewed on {formatDate(filteredPlanData.reviews[0].reviewed_at)} by {filteredPlanData.reviews[0].evaluator_name || 'Evaluator'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredPlanData.objectives?.length > 0 && (
          <div className="mb-8">
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                <h2 className="text-lg font-medium text-gray-900">Complete Plan Details</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Detailed view showing all objectives, initiatives, measures, and activities
                </p>
              </div>
              <div className="p-6">
                <PlanReviewTable
                  objectives={filteredPlanData.objectives || []}
                  onSubmit={async () => {}}
                  isSubmitting={false}
                  organizationName={organizationName}
                  plannerName={filteredPlanData.planner_name || 'N/A'}
                  fromDate={filteredPlanData.from_date || ''}
                  toDate={filteredPlanData.to_date || ''}
                  planType={filteredPlanData.type || 'N/A'}
                  isPreviewMode={true}
                  userOrgId={plannerOrgId}
                  isViewOnly={true}
                  planData={filteredPlanData}
                />
              </div>
            </div>
          </div>
        )}

        <div className="space-y-8">
          <div className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Organization Information</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start">
                <Building2 className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Organization Name</p>
                  <p className="font-medium">{organizationName}</p>
                </div>
              </div>
              <div className="flex items-start">
                <User className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Planner</p>
                  <p className="font-medium">{filteredPlanData.planner_name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-start">
                <FileType className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Plan Type</p>
                  <p className="font-medium">{getPlanTypeDisplay(filteredPlanData.type)}</p>
                </div>
              </div>
              <div className="flex items-start">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5 mr-2" />
                <div>
                  <p className="text-sm text-gray-500">Planning Period</p>
                  <p className="font-medium">
                    {formatDate(filteredPlanData.from_date)} - {formatDate(filteredPlanData.to_date)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {filteredPlanData.reviews?.length > 0 && (
            <div className="border-b border-gray-200 pb-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Evaluator Feedback</h2>
              <div className={`p-4 rounded-lg ${
                filteredPlanData.status === 'APPROVED' ? 'bg-green-50 border border-green-200' : 
                filteredPlanData.status === 'REJECTED' ? 'bg-red-50 border border-red-200' : 
                'bg-gray-50 border border-gray-200'
              }`}>
                <div className="flex items-start">
                  {filteredPlanData.status === 'APPROVED' ? (
                    <CheckCircle className="h-5 w-5 mr-2 text-green-500 mt-0.5" />
                  ) : filteredPlanData.status === 'REJECTED' ? (
                    <XCircle className="h-5 w-5 mr-2 text-red-500 mt-0.5" />
                  ) : (
                    <div className="h-5 w-5 mr-2" />
                  )}
                  <div>
                    <p className={`font-medium ${
                      filteredPlanData.status === 'APPROVED' ? 'text-green-700' : 
                      filteredPlanData.status === 'REJECTED' ? 'text-red-700' : 
                      'text-gray-700'
                    }`}>
                      {filteredPlanData.status === 'APPROVED' ? 'Plan Approved' : 
                       filteredPlanData.status === 'REJECTED' ? 'Plan Rejected' :
                       'Pending Review'}
                    </p>
                    {filteredPlanData.reviews[0]?.feedback && (
                      <p className="mt-1 text-gray-600">
                        {filteredPlanData.reviews[0].feedback}
                      </p>
                    )}
                    {filteredPlanData.reviews[0]?.reviewed_at && (
                      <p className="mt-2 text-sm text-gray-500">
                        Reviewed on {formatDate(filteredPlanData.reviews[0].reviewed_at)} by {filteredPlanData.reviews[0].evaluator_name || 'Evaluator'}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-600">Total Budget Required</p>
              <p className="text-2xl font-bold text-blue-900">
                ${budgetTotals.total.toLocaleString()}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <p className="text-sm text-green-600">Government Treasury</p>
              <p className="text-2xl font-bold text-green-900">
                ${budgetTotals.governmentTotal.toLocaleString()}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <p className="text-sm text-purple-600">Partners Funding</p>
              <p className="text-2xl font-bold text-purple-900">
                ${budgetTotals.partnersTotal.toLocaleString()}
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <p className="text-sm text-orange-600">SDG Funding</p>
              <p className="text-2xl font-bold text-orange-900">
                ${budgetTotals.sdgTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {showReviewForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Review Plan: {organizationName}
            </h3>
            
            <PlanReviewForm
              plan={filteredPlanData}
              onSubmit={handleReviewSubmit}
              onCancel={() => setShowReviewForm(false)}
              isSubmitting={isSubmitting || reviewPlanMutation.isPending}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanSummary;