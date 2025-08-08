import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle, 
  Target, 
  Activity, 
  BarChart3, 
  DollarSign, 
  Eye, 
  FileSpreadsheet,
  Loader,
  RefreshCw,
  Info,
  Calendar,
  User,
  Building2,
  FileType
} from 'lucide-react';
import { useLanguage } from '../lib/i18n/LanguageContext';
import { auth, organizations, objectives, initiatives, performanceMeasures, mainActivities, plans } from '../lib/api';
import { isPlanner } from '../types/user';
import type { StrategicObjective, Organization } from '../types/organization';
import type { PlanType, ActivityType, BudgetCalculationType } from '../types/plan';

// Import components
import PlanTypeSelector from '../components/PlanTypeSelector';
import ObjectiveSelectionMode from '../components/ObjectiveSelectionMode';
import HorizontalObjectiveSelector from '../components/HorizontalObjectiveSelector';
import CustomObjectiveSelector from '../components/CustomObjectiveSelector';
import StrategicObjectivesList from '../components/StrategicObjectivesList';
import InitiativeList from '../components/InitiativeList';
import InitiativeForm from '../components/InitiativeForm';
import PerformanceMeasureList from '../components/PerformanceMeasureList';
import PerformanceMeasureForm from '../components/PerformanceMeasureForm';
import MainActivityList from '../components/MainActivityList';
import MainActivityForm from '../components/MainActivityForm';
import ActivityBudgetForm from '../components/ActivityBudgetForm';
import ActivityBudgetDetails from '../components/ActivityBudgetDetails';
import PlanReviewTable from '../components/PlanReviewTable';
import PlanPreviewModal from '../components/PlanPreviewModal';
import TrainingCostingTool from '../components/TrainingCostingTool';
import MeetingWorkshopCostingTool from '../components/MeetingWorkshopCostingTool';
import PrintingCostingTool from '../components/PrintingCostingTool';
import ProcurementCostingTool from '../components/ProcurementCostingTool';
import SupervisionCostingTool from '../components/SupervisionCostingTool';

// Success Modal Component
const SuccessModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
}> = ({ isOpen, onClose, onViewPlans }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Plan Submitted Successfully!</h3>
          <p className="text-gray-600 mb-6">
            Your plan has been submitted for review. You can track its status in your submitted plans.
          </p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={onViewPlans}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              View My Plans
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Plan Status Modal Component
const PlanStatusModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onViewPlans: () => void;
  planStatus: string;
  message: string;
}> = ({ isOpen, onClose, onViewPlans, planStatus, message }) => {
  if (!isOpen) return null;

  const getStatusIcon = () => {
    switch (planStatus) {
      case 'SUBMITTED':
        return <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />;
      case 'APPROVED':
        return <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />;
      case 'REJECTED':
        return <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />;
      default:
        return <Info className="h-12 w-12 text-blue-500 mx-auto mb-4" />;
    }
  };

  const getStatusColor = () => {
    switch (planStatus) {
      case 'SUBMITTED':
        return 'text-yellow-800';
      case 'APPROVED':
        return 'text-green-800';
      case 'REJECTED':
        return 'text-red-800';
      default:
        return 'text-blue-800';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="text-center">
          {getStatusIcon()}
          <h3 className={`text-lg font-medium mb-2 ${getStatusColor()}`}>
            Plan Status: {planStatus}
          </h3>
          <p className="text-gray-600 mb-6">{message}</p>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Close
            </button>
            <button
              onClick={onViewPlans}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {planStatus === 'REJECTED' ? 'Create New Plan' : 'View My Plans'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Budget Calculation Type Selection Modal
const BudgetCalculationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSelectCalculationType: (type: BudgetCalculationType, activityType?: ActivityType) => void;
}> = ({ isOpen, onClose, onSelectCalculationType }) => {
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType>('Training');

  if (!isOpen) return null;

  const activityTypes: { value: ActivityType; label: string; description: string }[] = [
    { value: 'Training', label: 'Training', description: 'Training sessions, workshops, capacity building' },
    { value: 'Meeting', label: 'Meeting', description: 'Meetings, conferences, consultations' },
    { value: 'Workshop', label: 'Workshop', description: 'Workshops, seminars, technical sessions' },
    { value: 'Printing', label: 'Printing', description: 'Document printing, materials production' },
    { value: 'Supervision', label: 'Supervision', description: 'Supervision visits, monitoring activities' },
    { value: 'Procurement', label: 'Procurement', description: 'Equipment, supplies, materials procurement' },
    { value: 'Other', label: 'Other', description: 'Other activities not covered above' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Select Budget Calculation Method</h3>
        
        <div className="space-y-4">
          {/* Costing Tool Option */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Using Costing Tool (Recommended)</h4>
            <p className="text-sm text-gray-600 mb-4">
              Use our built-in costing tools to calculate accurate budgets based on activity type and location.
            </p>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Activity Type:
              </label>
              <select
                value={selectedActivityType}
                onChange={(e) => setSelectedActivityType(e.target.value as ActivityType)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {activityTypes.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.description}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              onClick={() => onSelectCalculationType('WITH_TOOL', selectedActivityType)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Use {selectedActivityType} Costing Tool
            </button>
          </div>

          {/* Manual Option */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-2">Manual Entry</h4>
            <p className="text-sm text-gray-600 mb-4">
              Enter budget amounts manually without using the costing tools.
            </p>
            
            <button
              onClick={() => onSelectCalculationType('WITHOUT_TOOL')}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
            >
              Enter Budget Manually
            </button>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const Planning: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Helper function to get organization name
  const getOrganizationName = (orgId: number | null, organizationsData: any[]): string => {
    if (!orgId || !organizationsData) return 'Unknown Organization';
    
    const org = organizationsData.find(o => o.id === orgId);
    return org?.name || 'Unknown Organization';
  };

  // State management
  const [currentStep, setCurrentStep] = useState<'plan-type' | 'objective-mode' | 'objectives' | 'planning' | 'review'>('plan-type');
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('LEO/EO Plan');
  const [objectiveSelectionMode, setObjectiveSelectionMode] = useState<'default' | 'custom'>('default');
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<any>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<any>(null);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  
  // Form states
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [showCostingTool, setShowCostingTool] = useState(false);
  const [showBudgetCalculationModal, setShowBudgetCalculationModal] = useState(false);
  
  // Edit states
  const [editingInitiative, setEditingInitiative] = useState<any>(null);
  const [editingMeasure, setEditingMeasure] = useState<any>(null);
  const [editingActivity, setEditingActivity] = useState<any>(null);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  
  // Budget states
  const [budgetCalculationType, setBudgetCalculationType] = useState<BudgetCalculationType>('WITHOUT_TOOL');
  const [selectedActivityType, setSelectedActivityType] = useState<ActivityType | null>(null);
  const [costingToolData, setCostingToolData] = useState<any>(null);
  
  // Modal states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [planStatusInfo, setPlanStatusInfo] = useState({ status: '', message: '' });
  
  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // User and organization data
  const [userOrganization, setUserOrganization] = useState<Organization | null>(null);
  const [userOrgId, setUserOrgId] = useState<number | null>(null);
  const [plannerName, setPlannerName] = useState('');
  const [isUserPlanner, setIsUserPlanner] = useState(false);
  
  // Plan dates
  const [fromDate, setFromDate] = useState(() => {
    const now = new Date();
    const fiscalYearStart = new Date(now.getFullYear(), 6, 1); // July 1st
    if (now < fiscalYearStart) {
      fiscalYearStart.setFullYear(now.getFullYear() - 1);
    }
    return fiscalYearStart.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    const now = new Date();
    const fiscalYearEnd = new Date(now.getFullYear() + 1, 5, 30); // June 30th next year
    if (now.getMonth() < 6) {
      fiscalYearEnd.setFullYear(now.getFullYear());
    }
    return fiscalYearEnd.toISOString().split('T')[0];
  });

  // Fetch organizations data
  const { data: organizationsData } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => organizations.getAll(),
  });

  // Check authentication and user permissions
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authData = await auth.getCurrentUser();
        
        if (!authData.isAuthenticated) {
          navigate('/login');
          return;
        }

        // Check if user is a planner
        const userIsPlanner = isPlanner(authData.userOrganizations);
        setIsUserPlanner(userIsPlanner);
        
        if (!userIsPlanner) {
          navigate('/dashboard');
          return;
        }

        // Set user data
        if (authData.userOrganizations && authData.userOrganizations.length > 0) {
          const userOrgData = authData.userOrganizations[0];
          setUserOrgId(userOrgData.organization);
          
          // Find organization details
          if (organizationsData && Array.isArray(organizationsData)) {
            const org = organizationsData.find(o => o.id === userOrgData.organization);
            setUserOrganization(org || null);
          }
        }

        // Set planner name
        const fullName = `${authData.user?.first_name || ''} ${authData.user?.last_name || ''}`.trim();
        setPlannerName(fullName || authData.user?.username || 'Unknown Planner');

        // Check for existing plans and their status
        await checkExistingPlanStatus(authData.userOrganizations[0]?.organization);
        
      } catch (error) {
        console.error('Authentication check failed:', error);
        navigate('/login');
      }
    };

    checkAuth();
  }, [navigate, organizationsData]);

  // Check for existing plan status
  const checkExistingPlanStatus = async (orgId: number) => {
    try {
      console.log('Checking existing plan status for organization:', orgId);
      
      const response = await plans.getAll();
      const allPlans = response?.data || [];
      
      // Filter plans for the user's organization
      const userPlans = allPlans.filter(plan => 
        plan.organization === orgId && 
        ['SUBMITTED', 'APPROVED'].includes(plan.status)
      );
      
      console.log('Found existing plans:', userPlans.length);
      
      if (userPlans.length > 0) {
        const latestPlan = userPlans[0]; // Assuming the first one is the latest
        
        if (latestPlan.status === 'SUBMITTED') {
          setPlanStatusInfo({
            status: 'SUBMITTED',
            message: 'You already have a plan submitted for review. Please wait for the review to complete before creating a new plan.'
          });
          setShowStatusModal(true);
        } else if (latestPlan.status === 'APPROVED') {
          setPlanStatusInfo({
            status: 'APPROVED', 
            message: 'You already have an approved plan. Contact your administrator if you need to create a new plan.'
          });
          setShowStatusModal(true);
        }
      }
    } catch (error) {
      console.error('Error checking existing plan status:', error);
      // Don't block the user if we can't check - let them proceed
    }
  };

  // Event handlers
  const handlePlanTypeSelect = (type: PlanType) => {
    setSelectedPlanType(type);
    setCurrentStep('objective-mode');
  };

  const handleObjectiveModeSelect = (mode: 'default' | 'custom') => {
    setObjectiveSelectionMode(mode);
    setCurrentStep('objectives');
  };

  const handleObjectivesSelected = (objectives: StrategicObjective[]) => {
    console.log('Planning: Objectives selected:', objectives.length);
    setSelectedObjectives(objectives);
    
    if (objectives.length > 0) {
      // Auto-select the first objective for planning
      setSelectedObjective(objectives[0]);
    }
  };

  const handleProceedToPlanning = () => {
    if (selectedObjectives.length === 0) {
      alert('Please select at least one objective before proceeding');
      return;
    }
    setCurrentStep('planning');
  };

  const handleSelectObjective = (objective: StrategicObjective) => {
    setSelectedObjective(objective);
    setSelectedProgram(null);
    setSelectedInitiative(null);
    setSelectedActivity(null);
  };

  const handleSelectProgram = (program: any) => {
    setSelectedProgram(program);
    setSelectedObjective(null);
    setSelectedInitiative(null);
    setSelectedActivity(null);
  };

  const handleSelectInitiative = (initiative: any) => {
    setSelectedInitiative(initiative);
    setSelectedActivity(null);
  };

  const handleSelectActivity = (activity: any) => {
    setSelectedActivity(activity);
  };

  // Initiative management
  const handleEditInitiative = (initiative: any) => {
    setEditingInitiative(initiative);
    setShowInitiativeForm(true);
  };

  const handleSaveInitiative = async (data: any) => {
    try {
      if (editingInitiative?.id) {
        await initiatives.update(editingInitiative.id, data);
      } else {
        await initiatives.create(data);
      }
      
      // Refresh initiatives list
      queryClient.invalidateQueries({ queryKey: ['initiatives'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error) {
      console.error('Error saving initiative:', error);
      throw error;
    }
  };

  // Performance measure management
  const handleEditMeasure = (measure: any) => {
    setEditingMeasure(measure);
    setShowMeasureForm(true);
  };

  const handleSaveMeasure = async (data: any) => {
    try {
      if (editingMeasure?.id) {
        await performanceMeasures.update(editingMeasure.id, data);
      } else {
        await performanceMeasures.create(data);
      }
      
      // Refresh measures list
      queryClient.invalidateQueries({ queryKey: ['performance-measures'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error) {
      console.error('Error saving performance measure:', error);
      throw error;
    }
  };

  // Main activity management
  const handleEditActivity = (activity: any) => {
    setEditingActivity(activity);
    setShowActivityForm(true);
  };

  const handleSaveActivity = async (data: any) => {
    try {
      if (editingActivity?.id) {
        await mainActivities.update(editingActivity.id, data);
      } else {
        await mainActivities.create(data);
      }
      
      // Refresh activities list
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error) {
      console.error('Error saving main activity:', error);
      throw error;
    }
  };

  // Budget management
  const handleAddBudget = (activity: any) => {
    setSelectedActivity(activity);
    setEditingBudget(null);
    setCostingToolData(null);
    setShowBudgetCalculationModal(true);
  };

  const handleEditBudget = (activity: any) => {
    setSelectedActivity(activity);
    setEditingBudget(activity.budget);
    setBudgetCalculationType(activity.budget?.budget_calculation_type || 'WITHOUT_TOOL');
    setSelectedActivityType(activity.budget?.activity_type || null);
    setShowBudgetForm(true);
  };

  const handleViewBudget = (activity: any) => {
    setSelectedActivity(activity);
    setShowBudgetDetails(true);
  };

  // Handle budget deletion
  const handleDeleteBudget = async (activityId: string) => {
    try {
      console.log('Deleting budget for activity:', activityId);
      console.log('Deleting budget for activity:', activityId);
      
      // Call the API to delete the budget
      const response = await api.delete(`/activity-budgets/?activity=${activityId}`);
      console.log('Budget deletion response:', response);
      
      // Refresh the activities data to reflect the change
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      
      // Show success message
      console.log('Budget delete response:', response);
      setSuccessMessage('Budget deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
      
      queryClient.invalidateQueries({ queryKey: ['activity-budgets'] });
      
      // Show success message
      setSuccessMessage('Budget deleted successfully');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error('Error deleting budget:', error);
      setError('Failed to delete budget. Please try again.');
      setError('Failed to delete budget. Please try again.');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleSelectBudgetCalculationType = (type: BudgetCalculationType, activityType?: ActivityType) => {
    setBudgetCalculationType(type);
    setSelectedActivityType(activityType || null);
    setShowBudgetCalculationModal(false);
    
    if (type === 'WITH_TOOL' && activityType) {
      setShowCostingTool(true);
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleCostingToolComplete = (data: any) => {
    setCostingToolData(data);
    setShowCostingTool(false);
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async (data: any) => {
    try {
      if (!selectedActivity?.id) {
        throw new Error('No activity selected for budget');
      }

      // Update the activity's budget
      await mainActivities.updateBudget(selectedActivity.id, data);
      
      // Refresh activities list to show updated budget
      queryClient.invalidateQueries({ queryKey: ['main-activities'] });
      setRefreshKey(prev => prev + 1);
      
      handleCancel();
    } catch (error) {
      console.error('Error saving budget:', error);
      throw error;
    }
  };

  // Costing tool rendering
  const renderCostingTool = () => {
    if (!selectedActivityType) return null;

    const commonProps = {
      onCalculate: handleCostingToolComplete,
      onCancel: () => setShowCostingTool(false),
      initialData: costingToolData
    };

    switch (selectedActivityType) {
      case 'Training':
        return <TrainingCostingTool {...commonProps} />;
      case 'Meeting':
      case 'Workshop':
        return <MeetingWorkshopCostingTool {...commonProps} />;
      case 'Printing':
        return <PrintingCostingTool {...commonProps} />;
      case 'Procurement':
        return <ProcurementCostingTool {...commonProps} />;
      case 'Supervision':
        return <SupervisionCostingTool {...commonProps} />;
      default:
        return <div>Costing tool not available for this activity type</div>;
    }
  };

  // Cancel/close handlers
  const handleCancel = () => {
    setShowInitiativeForm(false);
    setShowMeasureForm(false);
    setShowActivityForm(false);
    setShowBudgetForm(false);
    setShowBudgetDetails(false);
    setShowCostingTool(false);
    setShowBudgetCalculationModal(false);
    setEditingInitiative(null);
    setEditingMeasure(null);
    setEditingActivity(null);
    setEditingBudget(null);
    setSelectedActivity(null);
    setCostingToolData(null);
  };

  // Navigation handlers
  const handleBack = () => {
    switch (currentStep) {
      case 'objective-mode':
        setCurrentStep('plan-type');
        break;
      case 'objectives':
        setCurrentStep('objective-mode');
        break;
      case 'planning':
        setCurrentStep('objectives');
        break;
      case 'review':
        setCurrentStep('planning');
        break;
    }
  };

  const handleProceedToReview = () => {
    setCurrentStep('review');
  };

  const handlePreviewPlan = () => {
    setShowPreviewModal(true);
  };

  // Enhanced plan submission with comprehensive validation and error handling
  const handleSubmitPlan = async () => {
    if (!userOrgId || selectedObjectives.length === 0) {
      alert('Please select objectives before submitting the plan');
      return;
    }

    setIsSubmitting(true);
    
    try {
      console.log('=== STARTING PLAN SUBMISSION ===');
      console.log('Selected objectives for submission:', selectedObjectives.length);
      console.log('User organization ID:', userOrgId);
      console.log('Planner name:', plannerName);
      
      // Pre-submission validation
      if (selectedObjectives.length === 0) {
        throw new Error('No objectives selected for submission');
      }

      // Validate that all objectives have proper weights
      const invalidObjectives = selectedObjectives.filter(obj => 
        !obj.effective_weight && !obj.planner_weight && !obj.weight
      );
      
      if (invalidObjectives.length > 0) {
        throw new Error(`Some objectives are missing weight information: ${invalidObjectives.map(obj => obj.title).join(', ')}`);
      }

      // Calculate total weight to ensure it's 100%
      const totalWeight = selectedObjectives.reduce((sum, obj) => {
        const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
        return sum + effectiveWeight;
      }, 0);

      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error(`Total objectives weight must be 100%. Current total: ${totalWeight.toFixed(2)}%`);
      }

      // Ensure fresh authentication and CSRF token
      console.log('Refreshing authentication...');
      await auth.getCurrentUser();

      // Prepare plan data with comprehensive objective information
      const planData = {
        organization: userOrgId,
        planner_name: plannerName,
        type: selectedPlanType,
        strategic_objective: selectedObjectives[0].id, // Primary objective for backward compatibility
        fiscal_year: new Date(fromDate).getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'SUBMITTED',
        // Include all selected objectives
        selected_objectives: selectedObjectives.map(obj => obj.id),
        // Include custom weights for each objective
        selected_objectives_weights: selectedObjectives.reduce((weights, obj) => {
          const effectiveWeight = obj.effective_weight || obj.planner_weight || obj.weight;
          weights[obj.id] = effectiveWeight;
          return weights;
        }, {} as Record<string, number>)
      };

      console.log('Plan data prepared for submission:', {
        ...planData,
        selected_objectives_count: planData.selected_objectives.length,
        weights_count: Object.keys(planData.selected_objectives_weights).length
      });

      // Submit plan with retry logic for production reliability
      let submitAttempt = 0;
      const maxAttempts = 3;
      let lastError;

      while (submitAttempt < maxAttempts) {
        try {
          submitAttempt++;
          console.log(`Plan submission attempt ${submitAttempt}/${maxAttempts}`);
          
          // Add timeout to prevent hanging requests
          const submitPromise = plans.create(planData);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Submission timeout after 15 seconds')), 15000)
          );
          
          const result = await Promise.race([submitPromise, timeoutPromise]);
          
          console.log('Plan submission successful:', result);
          
          // Validate that the plan was created with all objectives
          if (result?.data?.id) {
            console.log('Validating submitted plan...');
            
            // Fetch the created plan to verify all objectives were saved
            try {
              const createdPlan = await plans.getById(result.data.id);
              
              if (createdPlan?.selected_objectives) {
                const savedObjectivesCount = createdPlan.selected_objectives.length;
                const submittedObjectivesCount = selectedObjectives.length;
                
                console.log(`Validation: Submitted ${submittedObjectivesCount} objectives, saved ${savedObjectivesCount} objectives`);
                
                if (savedObjectivesCount !== submittedObjectivesCount) {
                  throw new Error(`Data integrity error: Submitted ${submittedObjectivesCount} objectives but only ${savedObjectivesCount} were saved`);
                }
                
                // Validate that all objective IDs were saved
                const savedObjectiveIds = createdPlan.selected_objectives.map(obj => obj.id || obj);
                const submittedObjectiveIds = selectedObjectives.map(obj => obj.id);
                
                const missingSavedIds = submittedObjectiveIds.filter(id => !savedObjectiveIds.includes(id));
                if (missingSavedIds.length > 0) {
                  throw new Error(`Missing objectives in saved plan: ${missingSavedIds.join(', ')}`);
                }
                
                console.log('✓ Plan validation successful - all objectives saved correctly');
              }
            } catch (validationError) {
              console.error('Plan validation failed:', validationError);
              throw new Error(`Plan was created but validation failed: ${validationError.message}`);
            }
          }
          
          // If we get here, submission was successful
          console.log('=== PLAN SUBMISSION COMPLETED SUCCESSFULLY ===');
          setShowSuccessModal(true);
          return;
          
        } catch (attemptError) {
          lastError = attemptError;
          console.warn(`Submission attempt ${submitAttempt} failed:`, attemptError);
          
          if (submitAttempt < maxAttempts) {
            // Wait before retry with exponential backoff
            const waitTime = Math.min(2000 * Math.pow(2, submitAttempt - 1), 8000);
            console.log(`Waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            
            // Refresh authentication before retry
            try {
              await auth.getCurrentUser();
            } catch (authError) {
              console.warn('Auth refresh failed before retry:', authError);
            }
          }
        }
      }
      
      // If all attempts failed, throw the last error
      throw lastError || new Error('Plan submission failed after all attempts');
      
    } catch (error: any) {
      console.error('=== PLAN SUBMISSION FAILED ===');
      console.error('Submission error:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Failed to submit plan. Please try again.';
      
      if (error.response?.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(`Submission failed: ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewMyPlans = () => {
    navigate('/dashboard', { 
      state: { activeTab: 'submitted' },
      replace: true 
    });
  };

  const handleCreateNewPlan = () => {
    // Reset all state to start fresh
    setCurrentStep('plan-type');
    setSelectedObjectives([]);
    setSelectedObjective(null);
    setSelectedProgram(null);
    setSelectedInitiative(null);
    setSelectedActivity(null);
    setShowStatusModal(false);
  };

  // Don't render anything if user is not a planner
  if (!isUserPlanner) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center p-8 bg-yellow-50 rounded-lg border border-yellow-200">
          <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-yellow-700 mb-2">Access Restricted</h2>
          <p className="text-yellow-600">You need planner permissions to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Strategic Planning</h1>
            <p className="text-gray-600">Create and manage your strategic plans</p>
          </div>
          
          {currentStep === 'planning' && (
            <div className="flex space-x-3">
              <button
                onClick={handlePreviewPlan}
                className="flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview Plan
              </button>
              <button
                onClick={handleProceedToReview}
                className="flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700"
              >
                Proceed to Review
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Step 1: Plan Type Selection */}
        {currentStep === 'plan-type' && (
          <PlanTypeSelector onSelectPlanType={handlePlanTypeSelect} />
        )}

        {/* Step 2: Objective Selection Mode */}
        {currentStep === 'objective-mode' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Plan Type
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Select Objective Mode</h2>
              <div></div>
            </div>
            <ObjectiveSelectionMode onSelectMode={handleObjectiveModeSelect} />
          </div>
        )}

        {/* Step 3: Objective Selection */}
        {currentStep === 'objectives' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Mode Selection
              </button>
              <h2 className="text-xl font-semibold text-gray-900">
                {objectiveSelectionMode === 'default' ? 'Select Default Objective' : 'Select Custom Objectives'}
              </h2>
              <div></div>
            </div>

            {objectiveSelectionMode === 'default' ? (
              <HorizontalObjectiveSelector
                onObjectivesSelected={handleObjectivesSelected}
                onProceed={handleProceedToPlanning}
                initialObjectives={selectedObjectives}
              />
            ) : (
              <div className="space-y-6">
                <CustomObjectiveSelector
                  onObjectivesSelected={handleObjectivesSelected}
                  initialObjectives={selectedObjectives}
                />
                
                {selectedObjectives.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={handleProceedToPlanning}
                      className="flex items-center px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      Proceed to Planning
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Planning */}
        {currentStep === 'planning' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Objectives
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Strategic Planning</h2>
              <div></div>
            </div>

            {/* Planning Header */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-500" />
                      Organization
                    </div>
                  </label>
                  <div className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md bg-gray-50">
                    {getOrganizationName(userOrgId, organizationsData || [])}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-500" />
                      Planner Name
                    </div>
                  </label>
                  <div className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md bg-gray-50">
                    {plannerName}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <FileType className="h-4 w-4 text-gray-500" />
                      Plan Type
                    </div>
                  </label>
                  <select
                    value={selectedPlanType}
                    onChange={(e) => setSelectedPlanType(e.target.value as PlanType)}
                    className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="LEO/EO Plan">LEO/EO Plan</option>
                    <option value="Desk/Team Plan">Desk/Team Plan</option>
                    <option value="Individual Plan">Individual Plan</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="from-date" className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      From Date
                    </div>
                  </label>
                  <input
                    type="date"
                    id="from-date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="to-date" className="block text-sm font-medium text-gray-700 mb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      To Date
                    </div>
                  </label>
                  <input
                    type="date"
                    id="to-date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    min={fromDate}
                    className="mt-1 block w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Three-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Objectives */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Selected Objectives</h3>
                <StrategicObjectivesList
                  onSelectObjective={handleSelectObjective}
                  selectedObjectiveId={selectedObjective?.id}
                  onSelectProgram={handleSelectProgram}
                  selectedObjectives={selectedObjectives}
                />
              </div>

              {/* Middle Column: Initiatives */}
              <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  {selectedObjective ? `Initiatives for ${selectedObjective.title}` : 
                   selectedProgram ? `Initiatives for ${selectedProgram.name}` : 
                   'Select an Objective or Program'}
                </h3>
                
                {selectedObjective || selectedProgram ? (
                  <InitiativeList
                    parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                    parentType={selectedObjective ? 'objective' : 'program'}
                    parentWeight={selectedObjective ? 
                      (selectedObjective.effective_weight !== undefined ? selectedObjective.effective_weight :
                       selectedObjective.planner_weight !== undefined && selectedObjective.planner_weight !== null ? selectedObjective.planner_weight :
                       selectedObjective.weight) : 
                      (selectedProgram?.strategic_objective?.weight || 100)}
                    selectedObjectiveData={selectedObjective}
                    onEditInitiative={handleEditInitiative}
                    onSelectInitiative={handleSelectInitiative}
                    isNewPlan={true}
                    planKey={refreshKey.toString()}
                    isUserPlanner={isUserPlanner}
                    userOrgId={userOrgId}
                  />
                ) : (
                  <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <Target className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Select an objective or program to view initiatives</p>
                  </div>
                )}
              </div>

              {/* Right Column: Performance Measures and Main Activities */}
              <div className="space-y-6">
                {/* Performance Measures */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {selectedInitiative ? `Performance Measures for ${selectedInitiative.name}` : 'Select an Initiative'}
                  </h3>
                  
                  {selectedInitiative ? (
                    <PerformanceMeasureList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={selectedInitiative.weight}
                      onEditMeasure={handleEditMeasure}
                      onSelectMeasure={() => {}}
                      isNewPlan={true}
                      planKey={refreshKey.toString()}
                    />
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <BarChart3 className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view performance measures</p>
                    </div>
                  )}
                </div>

                {/* Main Activities */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    {selectedInitiative ? `Main Activities for ${selectedInitiative.name}` : 'Select an Initiative'}
                  </h3>
                  
                  {selectedInitiative ? (
                    <MainActivityList
                      initiativeId={selectedInitiative.id}
                      initiativeWeight={selectedInitiative.weight}
                      onEditActivity={handleEditActivity}
                      onSelectActivity={handleSelectActivity}
                      onAddBudget={handleAddBudget}
                      onViewBudget={handleViewBudget}
                      onEditBudget={handleEditBudget}
                      isNewPlan={true}
                      planKey={refreshKey.toString()}
                      isUserPlanner={isUserPlanner}
                      userOrgId={userOrgId}
                    />
                  ) : (
                    <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                      <DollarSign className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Select an initiative to view main activities</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Planning
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Review Your Plan</h2>
              <div></div>
            </div>

            <PlanReviewTable
              objectives={selectedObjectives}
              onSubmit={handleSubmitPlan}
              isSubmitting={isSubmitting}
              organizationName={getOrganizationName(userOrgId, organizationsData || [])}
              plannerName={plannerName}
              fromDate={fromDate}
              toDate={toDate}
              planType={selectedPlanType}
              userOrgId={userOrgId}
            />
          </div>
        )}
      </div>

      {/* Modals and Forms */}
      
      {/* Budget Calculation Type Selection Modal */}
      <BudgetCalculationModal
        isOpen={showBudgetCalculationModal}
        onClose={() => setShowBudgetCalculationModal(false)}
        onSelectCalculationType={handleSelectBudgetCalculationType}
      />
      
      {/* Initiative Form Modal */}
      {showInitiativeForm && (selectedObjective || selectedProgram) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingInitiative?.id ? 'Edit Initiative' : 'Create Initiative'}
            </h3>
            
            {(() => {
              // Calculate the effective weight for the form
              let formParentWeight = 100;
              let selectedObjectiveData = null;
              
              if (selectedObjective) {
                // Find the selected objective in the selectedObjectives array
                selectedObjectiveData = selectedObjectives.find(obj => obj.id === selectedObjective.id);
                
                if (selectedObjectiveData) {
                  formParentWeight = selectedObjectiveData.effective_weight !== undefined 
                    ? selectedObjectiveData.effective_weight
                    : selectedObjectiveData.planner_weight !== undefined && selectedObjectiveData.planner_weight !== null
                      ? selectedObjectiveData.planner_weight
                      : selectedObjectiveData.weight;
                } else {
                  formParentWeight = selectedObjective.effective_weight !== undefined 
                    ? selectedObjective.effective_weight
                    : selectedObjective.planner_weight !== undefined && selectedObjective.planner_weight !== null
                      ? selectedObjective.planner_weight
                      : selectedObjective.weight;
                }
              } else if (selectedProgram) {
                const parentObjective = selectedObjectives.find(obj => 
                  obj.id === selectedProgram.strategic_objective_id || 
                  obj.id === selectedProgram.strategic_objective?.id
                );
                
                if (parentObjective) {
                  formParentWeight = parentObjective.effective_weight !== undefined 
                    ? parentObjective.effective_weight
                    : parentObjective.planner_weight !== undefined && parentObjective.planner_weight !== null
                      ? parentObjective.planner_weight
                      : parentObjective.weight;
                } else {
                  formParentWeight = selectedProgram.strategic_objective?.weight || 100;
                }
              }
              
              console.log('InitiativeForm Modal - Weight calculation:', {
                selectedObjective: selectedObjective?.title,
                selectedProgram: selectedProgram?.name,
                selectedObjectiveData: selectedObjectiveData ? 'found' : 'not found',
                formParentWeight,
                originalWeight: selectedObjective?.weight || selectedProgram?.strategic_objective?.weight
              });
              
              return (
                <InitiativeForm
                  parentId={(selectedObjective?.id || selectedProgram?.id)?.toString() || ''}
                  parentType={selectedObjective ? 'objective' : 'program'}
                  parentWeight={formParentWeight}
                  selectedObjectiveData={selectedObjectiveData}
                  currentTotal={0}
                  onSubmit={handleSaveInitiative}
                  onCancel={handleCancel}
                  initialData={editingInitiative}
                />
              );
            })()}
          </div>
        </div>
      )}

      {/* Performance Measure Form Modal */}
      {showMeasureForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingMeasure?.id ? 'Edit Performance Measure' : 'Create Performance Measure'}
            </h3>
            
            <PerformanceMeasureForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveMeasure}
              onCancel={handleCancel}
              initialData={editingMeasure}
            />
          </div>
        </div>
      )}

      {/* Main Activity Form Modal */}
      {showActivityForm && selectedInitiative && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingActivity?.id ? 'Edit Main Activity' : 'Create Main Activity'}
            </h3>
            
            <MainActivityForm
              initiativeId={selectedInitiative.id}
              currentTotal={0}
              onSubmit={handleSaveActivity}
              onCancel={handleCancel}
              initialData={editingActivity}
            />
          </div>
        </div>
      )}

      {/* Costing Tool Modal */}
      {showCostingTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedActivityType} Cost Calculator
              </h3>
              {renderCostingTool()}
            </div>
          </div>
        </div>
      )}

      {/* Budget Form Modal */}
      {showBudgetForm && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              {editingBudget ? 'Edit Budget' : 'Add Budget'} - {selectedActivity.name}
            </h3>
            
            <ActivityBudgetForm
              activity={selectedActivity}
              budgetCalculationType={budgetCalculationType}
              activityType={selectedActivityType}
              onSubmit={handleSaveBudget}
              onCancel={handleCancel}
              initialData={editingBudget || costingToolData}
              isSubmitting={isSubmitting}
            />
          </div>
        </div>
      )}

      {/* Budget Details Modal */}
      {showBudgetDetails && selectedActivity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <ActivityBudgetDetails
              activity={selectedActivity}
              onBack={handleCancel}
              onEdit={() => {
                setShowBudgetDetails(false);
                handleEditBudget(selectedActivity);
              }}
              isReadOnly={!isUserPlanner}
            />
          </div>
        </div>
      )}

      {/* Plan Preview Modal */}
      <PlanPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        objectives={selectedObjectives}
        organizationName={getOrganizationName(userOrgId, organizationsData || [])}
        plannerName={plannerName}
        fromDate={fromDate}
        toDate={toDate}
        planType={selectedPlanType}
        refreshKey={refreshKey}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccessModal}
        onClose={() => {
          setShowSuccessModal(false);
          handleViewMyPlans();
        }}
        onViewPlans={handleViewMyPlans}
      />

      {/* Plan Status Modal */}
      <PlanStatusModal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        onViewPlans={() => {
          setShowStatusModal(false);
          if (planStatusInfo.status === 'REJECTED') {
            handleCreateNewPlan();
          } else {
            handleViewMyPlans();
          }
        }}
        planStatus={planStatusInfo.status}
        message={planStatusInfo.message}
      />
    </div>
  );
};

export default Planning;