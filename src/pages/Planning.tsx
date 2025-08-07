import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Plus, DollarSign, Eye, Edit, Trash2, Calculator, FileText } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useOrganization } from '../contexts/OrganizationContext';
import { strategicObjectives, programs, initiatives, performanceMeasures, mainActivities, plans } from '../services/api';
import { StrategicObjective, Program, Initiative, PerformanceMeasure, MainActivity, PlanType } from '../types';
import ObjectiveCard from '../components/planning/ObjectiveCard';
import ProgramCard from '../components/planning/ProgramCard';
import InitiativeCard from '../components/planning/InitiativeCard';
import InitiativeForm from '../components/planning/InitiativeForm';
import PerformanceMeasureForm from '../components/planning/PerformanceMeasureForm';
import MainActivityForm from '../components/planning/MainActivityForm';
import ActivityBudgetForm from '../components/planning/ActivityBudgetForm';
import ActivityBudgetDetails from '../components/planning/ActivityBudgetDetails';
import PlanReviewTable from '../components/planning/PlanReviewTable';
import PlanPreviewModal from '../components/planning/PlanPreviewModal';
import SuccessModal from '../components/planning/SuccessModal';
import PlanStatusModal from '../components/planning/PlanStatusModal';
import CostingTool from '../components/planning/CostingTool';
import Cookies from 'js-cookie';

const Planning: React.FC = () => {
  const navigate = useNavigate();
  const { user, auth } = useAuth();
  const { userOrganization, userOrgId } = useOrganization();

  // State management
  const [currentStep, setCurrentStep] = useState<'objectives' | 'programs' | 'planning' | 'review'>('objectives');
  const [selectedObjectives, setSelectedObjectives] = useState<StrategicObjective[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<MainActivity | null>(null);
  const [selectedObjective, setSelectedObjective] = useState<StrategicObjective | null>(null);
  const [selectedActivityType, setSelectedActivityType] = useState<string>('');
  const [budgetCalculationType, setBudgetCalculationType] = useState<'manual' | 'costing_tool'>('manual');
  const [costingToolData, setCostingToolData] = useState<any>(null);

  // Form states
  const [showInitiativeForm, setShowInitiativeForm] = useState(false);
  const [showMeasureForm, setShowMeasureForm] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [showBudgetDetails, setShowBudgetDetails] = useState(false);
  const [showCostingTool, setShowCostingTool] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  // Edit states
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [editingMeasure, setEditingMeasure] = useState<PerformanceMeasure | null>(null);
  const [editingActivity, setEditingActivity] = useState<MainActivity | null>(null);
  const [editingBudget, setEditingBudget] = useState<any>(null);

  // Data states
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [initiativesList, setInitiativesList] = useState<Initiative[]>([]);
  const [measures, setMeasures] = useState<PerformanceMeasure[]>([]);
  const [activities, setActivities] = useState<MainActivity[]>([]);

  // Plan form states
  const [plannerName, setPlannerName] = useState('');
  const [executiveName, setExecutiveName] = useState('');
  const [selectedPlanType, setSelectedPlanType] = useState<PlanType>('ANNUAL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // UI states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [planStatusInfo, setPlanStatusInfo] = useState({ status: '', message: '' });

  // User permissions
  const isUserPlanner = user?.role === 'PLANNER';

  // Initialize dates and planner name
  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    
    setFromDate(`${nextYear}-01-01`);
    setToDate(`${nextYear}-12-31`);
    
    if (user?.first_name && user?.last_name) {
      setPlannerName(`${user.first_name} ${user.last_name}`);
    }
  }, [user]);

  // Load initial data
  useEffect(() => {
    if (userOrgId) {
      loadObjectives();
    }
  }, [userOrgId]);

  const loadObjectives = async () => {
    try {
      setLoading(true);
      const data = await strategicObjectives.getAll(userOrgId);
      setObjectives(data);
    } catch (error) {
      console.error('Error loading objectives:', error);
      setError('Failed to load strategic objectives');
    } finally {
      setLoading(false);
    }
  };

  const loadPrograms = async () => {
    if (selectedObjectives.length === 0) return;
    
    try {
      setLoading(true);
      const objectiveIds = selectedObjectives.map(obj => obj.id);
      const allPrograms = await Promise.all(
        objectiveIds.map(id => programs.getByObjective(id))
      );
      const flatPrograms = allPrograms.flat();
      setPrograms(flatPrograms);
    } catch (error) {
      console.error('Error loading programs:', error);
      setError('Failed to load programs');
    } finally {
      setLoading(false);
    }
  };

  const loadInitiatives = async () => {
    if (selectedObjectives.length === 0) return;
    
    try {
      setLoading(true);
      const objectiveIds = selectedObjectives.map(obj => obj.id);
      const allInitiatives = await Promise.all(
        objectiveIds.map(id => initiatives.getByObjective(id))
      );
      const flatInitiatives = allInitiatives.flat();
      setInitiativesList(flatInitiatives);
    } catch (error) {
      console.error('Error loading initiatives:', error);
      setError('Failed to load initiatives');
    } finally {
      setLoading(false);
    }
  };

  const loadMeasures = async (initiativeId: number) => {
    try {
      const data = await performanceMeasures.getByInitiative(initiativeId);
      setMeasures(data);
    } catch (error) {
      console.error('Error loading measures:', error);
      setError('Failed to load performance measures');
    }
  };

  const loadActivities = async (initiativeId: number) => {
    try {
      const data = await mainActivities.getByInitiative(initiativeId);
      setActivities(data);
    } catch (error) {
      console.error('Error loading activities:', error);
      setError('Failed to load main activities');
    }
  };

  // Navigation handlers
  const handleNext = () => {
    if (currentStep === 'objectives' && selectedObjectives.length > 0) {
      setCurrentStep('programs');
      loadPrograms();
    } else if (currentStep === 'programs') {
      setCurrentStep('planning');
      loadInitiatives();
    } else if (currentStep === 'planning') {
      setCurrentStep('review');
    }
  };

  const handleBack = () => {
    if (currentStep === 'programs') {
      setCurrentStep('objectives');
    } else if (currentStep === 'planning') {
      setCurrentStep('programs');
    } else if (currentStep === 'review') {
      setCurrentStep('planning');
    }
  };

  // Objective selection handlers
  const handleObjectiveToggle = (objective: StrategicObjective) => {
    setSelectedObjectives(prev => {
      const isSelected = prev.some(obj => obj.id === objective.id);
      if (isSelected) {
        return prev.filter(obj => obj.id !== objective.id);
      } else {
        return [...prev, objective];
      }
    });
  };

  const handleObjectiveWeightChange = (objectiveId: number, weight: number) => {
    setSelectedObjectives(prev => 
      prev.map(obj => 
        obj.id === objectiveId 
          ? { ...obj, planner_weight: weight, effective_weight: weight }
          : obj
      )
    );
  };

  // Initiative handlers
  const handleCreateInitiative = (objective?: StrategicObjective, program?: Program) => {
    setSelectedObjective(objective || null);
    setSelectedProgram(program || null);
    setEditingInitiative(null);
    setShowInitiativeForm(true);
  };

  const handleEditInitiative = (initiative: Initiative) => {
    setEditingInitiative(initiative);
    setSelectedObjective(null);
    setSelectedProgram(null);
    setShowInitiativeForm(true);
  };

  const handleSaveInitiative = async (data: any) => {
    try {
      setIsSubmitting(true);
      if (editingInitiative?.id) {
        await initiatives.update(editingInitiative.id, data);
      } else {
        await initiatives.create(data);
      }
      setShowInitiativeForm(false);
      setEditingInitiative(null);
      setSelectedObjective(null);
      setSelectedProgram(null);
      loadInitiatives();
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error saving initiative:', error);
      setError('Failed to save initiative');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInitiative = async (initiativeId: number) => {
    if (!window.confirm('Are you sure you want to delete this initiative?')) return;
    
    try {
      await initiatives.delete(initiativeId);
      loadInitiatives();
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting initiative:', error);
      setError('Failed to delete initiative');
    }
  };

  // Performance measure handlers
  const handleCreateMeasure = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    setEditingMeasure(null);
    setShowMeasureForm(true);
  };

  const handleEditMeasure = (measure: PerformanceMeasure) => {
    setEditingMeasure(measure);
    setShowMeasureForm(true);
  };

  const handleSaveMeasure = async (data: any) => {
    try {
      setIsSubmitting(true);
      if (editingMeasure?.id) {
        await performanceMeasures.update(editingMeasure.id, data);
      } else {
        await performanceMeasures.create(data);
      }
      setShowMeasureForm(false);
      setEditingMeasure(null);
      if (selectedInitiative) {
        loadMeasures(selectedInitiative.id);
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error saving measure:', error);
      setError('Failed to save performance measure');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMeasure = async (measureId: number) => {
    if (!window.confirm('Are you sure you want to delete this performance measure?')) return;
    
    try {
      await performanceMeasures.delete(measureId);
      if (selectedInitiative) {
        loadMeasures(selectedInitiative.id);
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting measure:', error);
      setError('Failed to delete performance measure');
    }
  };

  // Main activity handlers
  const handleCreateActivity = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    setEditingActivity(null);
    setShowActivityForm(true);
  };

  const handleEditActivity = (activity: MainActivity) => {
    setEditingActivity(activity);
    setShowActivityForm(true);
  };

  const handleSaveActivity = async (data: any) => {
    try {
      setIsSubmitting(true);
      if (editingActivity?.id) {
        await mainActivities.update(editingActivity.id, data);
      } else {
        await mainActivities.create(data);
      }
      setShowActivityForm(false);
      setEditingActivity(null);
      if (selectedInitiative) {
        loadActivities(selectedInitiative.id);
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error saving activity:', error);
      setError('Failed to save main activity');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivity = async (activityId: number) => {
    if (!window.confirm('Are you sure you want to delete this main activity?')) return;
    
    try {
      await mainActivities.delete(activityId);
      if (selectedInitiative) {
        loadActivities(selectedInitiative.id);
      }
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting activity:', error);
      setError('Failed to delete main activity');
    }
  };

  // Budget handlers
  const handleAddBudget = (activity: MainActivity, activityType: string, calculationType: 'manual' | 'costing_tool' = 'manual') => {
    setSelectedActivity(activity);
    setSelectedActivityType(activityType);
    setBudgetCalculationType(calculationType);
    setEditingBudget(null);
    setCostingToolData(null);
    
    if (calculationType === 'costing_tool') {
      setShowCostingTool(true);
    } else {
      setShowBudgetForm(true);
    }
  };

  const handleEditBudget = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setEditingBudget(activity.budget);
    setBudgetCalculationType('manual');
    setShowBudgetForm(true);
  };

  const handleSaveBudget = async (budgetData: any) => {
    try {
      setIsSubmitting(true);
      if (selectedActivity) {
        await mainActivities.updateBudget(selectedActivity.id, budgetData);
        loadActivities(selectedActivity.initiative_id);
        setRefreshKey(prev => prev + 1);
      }
      setShowBudgetForm(false);
      setShowCostingTool(false);
      setSelectedActivity(null);
      setCostingToolData(null);
    } catch (error) {
      console.error('Error saving budget:', error);
      setError('Failed to save budget');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewBudgetDetails = (activity: MainActivity) => {
    setSelectedActivity(activity);
    setShowBudgetDetails(true);
  };

  const handleCostingToolComplete = (data: any) => {
    setCostingToolData(data);
    setShowCostingTool(false);
    setShowBudgetForm(true);
  };

  // Initiative selection handlers
  const handleInitiativeSelect = (initiative: Initiative) => {
    setSelectedInitiative(initiative);
    loadMeasures(initiative.id);
    loadActivities(initiative.id);
  };

  // Modal handlers
  const handleCancel = () => {
    setShowInitiativeForm(false);
    setShowMeasureForm(false);
    setShowActivityForm(false);
    setShowBudgetForm(false);
    setShowBudgetDetails(false);
    setShowCostingTool(false);
    setEditingInitiative(null);
    setEditingMeasure(null);
    setEditingActivity(null);
    setEditingBudget(null);
    setSelectedObjective(null);
    setSelectedProgram(null);
    setSelectedActivity(null);
    setCostingToolData(null);
  };

  // Plan submission
  const handleSubmitPlan = async () => {
    try {
      setIsSubmitting(true);
      setError(null);
      
      console.log('=== PLAN SUBMISSION START ===');
      console.log('Environment:', import.meta.env.MODE);
      console.log('Selected objectives count:', selectedObjectives.length);
      console.log('Selected objectives data:', selectedObjectives.map(obj => ({
        id: obj.id,
        title: obj.title,
        weight: obj.weight,
        planner_weight: obj.planner_weight,
        effective_weight: obj.effective_weight
      })));
      
      // Ensure fresh authentication and CSRF token for production
      try {
        console.log('Refreshing authentication...');
        await auth.getCurrentUser();
        
        console.log('Getting fresh CSRF token...');
        await auth.csrf();
        
        const csrfToken = Cookies.get('csrftoken');
        console.log('CSRF token available:', !!csrfToken);
      } catch (authError) {
        console.error('Authentication/CSRF refresh failed:', authError);
        throw new Error('Authentication failed. Please refresh the page and try again.');
      }

      // Validate required fields
      if (!userOrganization?.id) {
        throw new Error('Organization not found');
      }

      if (!plannerName.trim()) {
        throw new Error('Planner name is required');
      }

      if (selectedObjectives.length === 0) {
        throw new Error('Please select at least one strategic objective');
      }

      // Validate that all selected objectives have valid IDs
      const invalidObjectives = selectedObjectives.filter(obj => !obj.id || typeof obj.id !== 'number');
      if (invalidObjectives.length > 0) {
        console.error('Invalid objectives found:', invalidObjectives);
        throw new Error('Some objectives have invalid IDs. Please refresh and try again.');
      }

      // Extract objective IDs and weights for the plan
      const objectiveIds = selectedObjectives.map(obj => Number(obj.id)).filter(id => !isNaN(id));
      const objectiveWeights: Record<string, number> = {};
      
      console.log('Extracted objective IDs:', objectiveIds);
      
      if (objectiveIds.length !== selectedObjectives.length) {
        console.error('ID extraction failed. Original count:', selectedObjectives.length, 'Extracted count:', objectiveIds.length);
        throw new Error('Failed to process objective IDs. Please refresh and try again.');
      }
      
      selectedObjectives.forEach(obj => {
        const effectiveWeight = obj.effective_weight !== undefined 
          ? obj.effective_weight
          : obj.planner_weight !== undefined && obj.planner_weight !== null
            ? obj.planner_weight
            : obj.weight;
        
        objectiveWeights[String(obj.id)] = Number(effectiveWeight);
      });

      console.log('Objective weights:', objectiveWeights);

      // Prepare plan data with proper format for production
      const planData = {
        organization: Number(userOrganization.id),
        planner_name: plannerName.trim(),
        type: selectedPlanType,
        executive_name: executiveName?.trim() || null,
        strategic_objective: Number(objectiveIds[0]), // Primary objective as number
        selected_objectives: objectiveIds, // Array of numbers only
        selected_objectives_weights: objectiveWeights,
        fiscal_year: new Date(fromDate).getFullYear().toString(),
        from_date: fromDate,
        to_date: toDate,
        status: 'DRAFT'
      };

      console.log('=== PLAN DATA FOR SUBMISSION ===');
      console.log('Plan data:', JSON.stringify(planData, null, 2));
      console.log('selected_objectives type:', typeof planData.selected_objectives);
      console.log('selected_objectives content:', planData.selected_objectives);
      console.log('selected_objectives_weights type:', typeof planData.selected_objectives_weights);
      console.log('selected_objectives_weights content:', planData.selected_objectives_weights);

      // Create the plan with enhanced error handling
      let createdPlan;
      try {
        console.log('Sending plan creation request...');
        createdPlan = await plans.create(planData);
        console.log('Plan created successfully:', createdPlan);
      } catch (createError) {
        console.error('Plan creation failed:', createError);
        console.error('Error response:', createError.response?.data);
        console.error('Error status:', createError.response?.status);
        
        // Handle specific validation errors
        if (createError.response?.status === 400) {
          const errorData = createError.response.data;
          if (errorData.selected_objectives) {
            throw new Error(`Objective selection error: ${JSON.stringify(errorData.selected_objectives)}`);
          }
          if (errorData.organization) {
            throw new Error(`Organization error: ${JSON.stringify(errorData.organization)}`);
          }
          if (errorData.strategic_objective) {
            throw new Error(`Strategic objective error: ${JSON.stringify(errorData.strategic_objective)}`);
          }
          throw new Error(`Validation error: ${JSON.stringify(errorData)}`);
        }
        
        throw createError;
      }

      if (!createdPlan || !createdPlan.id) {
        throw new Error('Plan was created but no ID was returned');
      }

      console.log('=== PLAN SUBMISSION START ===');
      console.log('Submitting plan ID:', createdPlan.id);

      // Submit the plan for review with enhanced error handling
      try {
        console.log('Sending plan submission request...');
        await plans.submitToEvaluator(createdPlan.id);
        console.log('Plan submitted successfully');
      } catch (submitError) {
        console.error('Plan submission failed:', submitError);
        console.error('Submit error response:', submitError.response?.data);
        console.error('Submit error status:', submitError.response?.status);
        
        // Even if submission fails, the plan was created
        throw new Error(`Plan was created but submission failed: ${submitError.message}`);
      }

      console.log('=== PLAN SUBMISSION COMPLETE ===');

      // Show success modal and refresh data
      setShowSuccessModal(true);
      setRefreshKey(prev => prev + 1);

    } catch (error: any) {
      console.error('Error submitting plan:', error);
      console.error('Full error object:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        config: error.config
      });
      
      setError(error.message || 'Failed to submit plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewMyPlans = () => {
    navigate('/my-plans');
  };

  const handleCreateNewPlan = () => {
    // Reset all state to start fresh
    setCurrentStep('objectives');
    setSelectedObjectives([]);
    setSelectedProgram(null);
    setSelectedInitiative(null);
    setSelectedActivity(null);
    setSelectedObjective(null);
    setShowStatusModal(false);
    setError(null);
    
    // Reset form data
    const currentYear = new Date().getFullYear();
    const nextYear = currentYear + 1;
    setFromDate(`${nextYear}-01-01`);
    setToDate(`${nextYear}-12-31`);
    setExecutiveName('');
    setSelectedPlanType('ANNUAL');
    
    // Reload objectives
    loadObjectives();
  };

  // Costing tool renderer
  const renderCostingTool = () => {
    if (!selectedActivity || !selectedActivityType) return null;

    return (
      <CostingTool
        activityType={selectedActivityType}
        onComplete={handleCostingToolComplete}
        onCancel={handleCancel}
      />
    );
  };

  if (loading && objectives.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Strategic Planning</h1>
        <p className="mt-2 text-gray-600">Create and manage your strategic plan</p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <div className="mb-8">
        <nav aria-label="Progress">
          <ol className="flex items-center">
            {[
              { id: 'objectives', name: 'Select Objectives', status: currentStep === 'objectives' ? 'current' : selectedObjectives.length > 0 ? 'complete' : 'upcoming' },
              { id: 'programs', name: 'Review Programs', status: currentStep === 'programs' ? 'current' : currentStep === 'planning' || currentStep === 'review' ? 'complete' : 'upcoming' },
              { id: 'planning', name: 'Plan Details', status: currentStep === 'planning' ? 'current' : currentStep === 'review' ? 'complete' : 'upcoming' },
              { id: 'review', name: 'Review & Submit', status: currentStep === 'review' ? 'current' : 'upcoming' }
            ].map((step, stepIdx) => (
              <li key={step.id} className={stepIdx !== 3 ? 'pr-8 sm:pr-20' : ''}>
                <div className="relative">
                  {step.status === 'complete' ? (
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-blue-600" />
                    </div>
                  ) : step.status === 'current' ? (
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center" aria-hidden="true">
                      <div className="h-0.5 w-full bg-gray-200" />
                    </div>
                  )}
                  <div className={`relative w-8 h-8 flex items-center justify-center rounded-full ${
                    step.status === 'complete' ? 'bg-blue-600' : 
                    step.status === 'current' ? 'border-2 border-blue-600 bg-white' : 
                    'border-2 border-gray-300 bg-white'
                  }`}>
                    <span className={`text-sm font-medium ${
                      step.status === 'complete' ? 'text-white' : 
                      step.status === 'current' ? 'text-blue-600' : 
                      'text-gray-500'
                    }`}>
                      {stepIdx + 1}
                    </span>
                  </div>
                  <span className="ml-4 text-sm font-medium text-gray-900">{step.name}</span>
                </div>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Step Content */}
      <div className="bg-white shadow rounded-lg">
        {/* Step 1: Select Objectives */}
        {currentStep === 'objectives' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Select Strategic Objectives</h2>
              <button
                onClick={handleNext}
                disabled={selectedObjectives.length === 0}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {objectives.map((objective) => (
                <ObjectiveCard
                  key={objective.id}
                  objective={objective}
                  isSelected={selectedObjectives.some(obj => obj.id === objective.id)}
                  onToggle={() => handleObjectiveToggle(objective)}
                  onWeightChange={handleObjectiveWeightChange}
                  selectedObjectives={selectedObjectives}
                />
              ))}
            </div>

            {objectives.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500">No strategic objectives found for your organization.</p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Review Programs */}
        {currentStep === 'programs' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={handleBack}
                className="flex items-center text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5 mr-1" />
                Back to Objectives
              </button>
              <h2 className="text-xl font-semibold text-gray-900">Review Programs</h2>
              <button
                onClick={handleNext}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
            </div>

            <div className="space-y-6">
              {selectedObjectives.map((objective) => {
                const objectivePrograms = programs.filter(p => 
                  p.strategic_objective_id === objective.id || 
                  p.strategic_objective?.id === objective.id
                );

                return (
                  <div key={objective.id} className="border rounded-lg p-4">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{objective.title}</h3>
                    
                    {objectivePrograms.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {objectivePrograms.map((program) => (
                          <ProgramCard key={program.id} program={program} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No programs found for this objective.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 3: Planning Details */}
        {currentStep === 'planning' && (
          <div className="space-y-6">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={handleBack}
                  className="flex items-center text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-5 w-5 mr-1" />
                  Back to Programs
                </button>
                <h2 className="text-xl font-semibold text-gray-900">Plan Details</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowPreviewModal(true)}
                    className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Plan Information Form */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Planner Name *
                  </label>
                  <input
                    type="text"
                    value={plannerName}
                    onChange={(e) => setPlannerName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Executive Name
                  </label>
                  <input
                    type="text"
                    value={executiveName}
                    onChange={(e) => setExecutiveName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Plan Type *
                  </label>
                  <select
                    value={selectedPlanType}
                    onChange={(e) => setSelectedPlanType(e.target.value as PlanType)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ANNUAL">Annual Plan</option>
                    <option value="STRATEGIC">Strategic Plan</option>
                    <option value="OPERATIONAL">Operational Plan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Organization
                  </label>
                  <input
                    type="text"
                    value={userOrganization?.name || 'Unknown Organization'}
                    disabled
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    From Date *
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    To Date *
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Initiatives Section */}
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Objectives and Initiatives */}
                <div className="lg:col-span-1 space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Initiatives</h3>
                  
                  {selectedObjectives.map((objective) => {
                    const objectiveInitiatives = initiativesList.filter(i => 
                      i.strategic_objective_id === objective.id || 
                      i.strategic_objective?.id === objective.id
                    );
                    const objectivePrograms = programs.filter(p => 
                      p.strategic_objective_id === objective.id || 
                      p.strategic_objective?.id === objective.id
                    );

                    return (
                      <div key={objective.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-gray-900 text-sm">{objective.title}</h4>
                          {isUserPlanner && (
                            <button
                              onClick={() => handleCreateInitiative(objective)}
                              className="text-blue-600 hover:text-blue-800"
                              title="Add Initiative"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Direct Initiatives */}
                        <div className="space-y-2">
                          {objectiveInitiatives.map((initiative) => (
                            <InitiativeCard
                              key={initiative.id}
                              initiative={initiative}
                              isSelected={selectedInitiative?.id === initiative.id}
                              onSelect={() => handleInitiativeSelect(initiative)}
                              onEdit={isUserPlanner ? handleEditInitiative : undefined}
                              onDelete={isUserPlanner ? handleDeleteInitiative : undefined}
                            />
                          ))}
                        </div>

                        {/* Program Initiatives */}
                        {objectivePrograms.map((program) => {
                          const programInitiatives = initiativesList.filter(i => 
                            i.program_id === program.id || 
                            i.program?.id === program.id
                          );

                          if (programInitiatives.length === 0 && !isUserPlanner) return null;

                          return (
                            <div key={program.id} className="mt-3 pl-4 border-l-2 border-gray-200">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="text-sm font-medium text-gray-700">{program.name}</h5>
                                {isUserPlanner && (
                                  <button
                                    onClick={() => handleCreateInitiative(undefined, program)}
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Add Initiative to Program"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <div className="space-y-2">
                                {programInitiatives.map((initiative) => (
                                  <InitiativeCard
                                    key={initiative.id}
                                    initiative={initiative}
                                    isSelected={selectedInitiative?.id === initiative.id}
                                    onSelect={() => handleInitiativeSelect(initiative)}
                                    onEdit={isUserPlanner ? handleEditInitiative : undefined}
                                    onDelete={isUserPlanner ? handleDeleteInitiative : undefined}
                                  />
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Right Panel: Initiative Details */}
                <div className="lg:col-span-2">
                  {selectedInitiative ? (
                    <div className="space-y-6">
                      {/* Initiative Header */}
                      <div className="bg-blue-50 rounded-lg p-4">
                        <h3 className="text-lg font-medium text-gray-900">{selectedInitiative.name}</h3>
                        <p className="text-sm text-gray-600 mt-1">{selectedInitiative.description}</p>
                      </div>

                      {/* Performance Measures */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-gray-900">Performance Measures</h4>
                          {isUserPlanner && (
                            <button
                              onClick={() => handleCreateMeasure(selectedInitiative)}
                              className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Measure
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          {measures.map((measure) => (
                            <div key={measure.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <h5 className="font-medium text-gray-900">{measure.name}</h5>
                                  <p className="text-sm text-gray-600">{measure.description}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span>Target: {measure.target_value}</span>
                                    <span>Unit: {measure.unit_of_measure}</span>
                                    <span>Frequency: {measure.reporting_frequency}</span>
                                  </div>
                                </div>
                                {isUserPlanner && (
                                  <div className="flex space-x-2">
                                    <button
                                      onClick={() => handleEditMeasure(measure)}
                                      className="text-blue-600 hover:text-blue-800"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMeasure(measure.id)}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {measures.length === 0 && (
                          <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <div className="text-gray-400 mb-2">📊</div>
                            <p className="text-gray-500 text-sm">No performance measures yet</p>
                          </div>
                        )}
                      </div>

                      {/* Main Activities */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-md font-medium text-gray-900">Main Activities</h4>
                          {isUserPlanner && (
                            <button
                              onClick={() => handleCreateActivity(selectedInitiative)}
                              className="flex items-center px-3 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add Activity
                            </button>
                          )}
                        </div>

                        <div className="space-y-3">
                          {activities.map((activity) => (
                            <div key={activity.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h5 className="font-medium text-gray-900">{activity.name}</h5>
                                  <p className="text-sm text-gray-600">{activity.description}</p>
                                  <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                    <span>Type: {activity.activity_type}</span>
                                    <span>Timeline: {activity.timeline}</span>
                                    {activity.budget && (
                                      <span className="text-green-600 font-medium">
                                        Budget: ${activity.budget.total_cost?.toLocaleString() || 'N/A'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {activity.budget ? (
                                    <button
                                      onClick={() => handleViewBudgetDetails(activity)}
                                      className="text-green-600 hover:text-green-800"
                                      title="View Budget Details"
                                    >
                                      <FileText className="h-4 w-4" />
                                    </button>
                                  ) : isUserPlanner && (
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => handleAddBudget(activity, activity.activity_type, 'manual')}
                                        className="text-blue-600 hover:text-blue-800"
                                        title="Add Budget Manually"
                                      >
                                        <DollarSign className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleAddBudget(activity, activity.activity_type, 'costing_tool')}
                                        className="text-purple-600 hover:text-purple-800"
                                        title="Use Costing Tool"
                                      >
                                        <Calculator className="h-4 w-4" />
                                      </button>
                                    </div>
                                  )}
                                  {isUserPlanner && (
                                    <>
                                      <button
                                        onClick={() => handleEditActivity(activity)}
                                        className="text-blue-600 hover:text-blue-800"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteActivity(activity.id)}
                                        className="text-red-600 hover:text-red-800"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        {activities.length === 0 && (
                          <div className="text-center p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                            <DollarSign className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-500 text-sm">No main activities yet</p>
                          </div>
                        )}
                      </div>
                    </div>
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

        {/* Step 4: Review */}
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
              organizationName={userOrganization?.name || 'Unknown Organization'}
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
        organizationName={userOrganization?.name || 'Unknown Organization'}
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