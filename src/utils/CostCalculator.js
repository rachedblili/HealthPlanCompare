// Cost Calculator - Clean 3-phase architecture for accurate family health plan comparison
export class CostCalculator {
  constructor() {
    this.scenarios = ['low', 'medium', 'high'];
  }

  // Main entry point - calculate all plans
  async calculateAll(plans, familyData) {
    if (!plans || plans.length === 0) {
      throw new Error('No plans provided for calculation');
    }

    if (!familyData || !familyData.members || familyData.members.length === 0) {
      throw new Error('No family data provided for calculation');
    }

    // Validate and normalize plan data
    const validatedPlans = plans.map(plan => this.validateAndNormalizePlan(plan));
    
    // Validate family data
    const validatedFamilyData = this.validateFamilyData(familyData);

    // Phase 1: Generate plan-agnostic usage timeline
    const usageTable = this.generateFamilyUsageTimeline(validatedFamilyData.members, validatedFamilyData.serviceCosts);

    // Phase 2: Apply each plan's rules to the usage table
    const planProgressions = {};
    const results = {};

    for (const plan of validatedPlans) {
      try {
        const progression = this.applyPlanRules(plan, usageTable, validatedFamilyData.members);
        planProgressions[plan.id] = progression;
        
        // Generate result summary from progression
        results[plan.id] = this.generatePlanResult(plan, progression, validatedFamilyData.members);
      } catch (error) {
        console.error(`Error calculating plan ${plan.id}:`, error);
        results[plan.id] = this.createErrorResult(plan, error);
      }
    }

    // Store progression data for exports
    this.lastUsageTable = usageTable;
    this.lastPlanProgressions = planProgressions;
    
    // Add comparison metrics
    this.addComparisonMetrics(results);
    
    return results;
  }

  // Phase 1: Generate plan-agnostic usage timeline
  generateFamilyUsageTimeline(members, serviceCosts) {
    const events = [];
    
    for (const member of members) {
      // Annual medical services - spread evenly throughout the year
      const annualServices = [
        { type: 'primaryVisit', count: member.primaryVisits, cost: serviceCosts.primaryVisit },
        { type: 'specialistVisit', count: member.specialistVisits, cost: serviceCosts.specialistVisit },
        { type: 'therapySession', count: member.therapyVisits, cost: serviceCosts.therapySession },
        { type: 'labWork', count: member.labWork, cost: serviceCosts.labWork },
        { type: 'imaging', count: member.imaging, cost: serviceCosts.basicImaging },
        { type: 'physicalTherapy', count: member.physicalTherapy, cost: serviceCosts.physicalTherapy }
      ];
      
      for (const service of annualServices) {
        if (service.count > 0) {
          const daysBetweenEvents = Math.floor(365 / service.count);
          for (let i = 0; i < service.count; i++) {
            const dayOfYear = Math.floor(daysBetweenEvents * i + daysBetweenEvents / 2);
            events.push({
              day: dayOfYear,
              memberId: member.id,
              memberName: member.name,
              eventType: 'medical',
              serviceType: service.type,
              grossCost: service.cost
            });
          }
        }
      }
      
      // Monthly medications - on 1st of each month
      if (member.medications && member.medications.length > 0) {
        for (const medication of member.medications) {
          // Skip medications with no cost or invalid data
          if (!medication.monthlyCost || medication.monthlyCost <= 0) continue;
          
          for (let month = 0; month < 12; month++) {
            const dayOfYear = month * 30 + 1; // Approximate 1st of each month
            events.push({
              day: dayOfYear,
              memberId: member.id,
              memberName: member.name,
              eventType: 'medication',
              serviceType: 'medication',
              medicationName: medication.name || 'Unknown',
              tier: parseInt(medication.tier) || 1,
              grossCost: medication.monthlyCost
            });
          }
        }
      }
    }
    
    // Sort events chronologically
    events.sort((a, b) => a.day - b.day);
    
    console.log(`📋 Generated usage timeline with ${events.length} events`);
    return events;
  }

  // Phase 2: Apply plan rules to usage timeline
  applyPlanRules(plan, usageTable, members) {
    const progression = [];
    
    // Initialize family-wide state
    const familyState = {
      deductibleUsed: 0,
      rxDeductibleUsed: 0,
      oopUsed: 0
    };
    
    // Initialize per-member state
    const memberStates = {};
    for (const member of members) {
      memberStates[member.id] = {
        deductibleUsed: 0,
        oopUsed: 0
      };
    }
    
    // Determine premium structure
    const { coverageType, monthlyPremium } = this.determinePremiumTier(plan, members);
    
    // Process each usage event chronologically
    for (const usageEvent of usageTable) {
      // Calculate event cost under this plan
      const eventResult = this.processEventUnderPlan(plan, usageEvent, familyState, memberStates);
      
      // Update individual member state first
      memberStates[usageEvent.memberId].deductibleUsed += eventResult.appliedToIndividualDeductible;
      const newIndividualOOP = memberStates[usageEvent.memberId].oopUsed + eventResult.memberCost;
      
      // Apply individual OOP maximum cap
      const individualOOPMax = plan.individualOOPMax || Infinity;
      const cappedIndividualOOP = Math.min(newIndividualOOP, individualOOPMax);
      const actualMemberCost = cappedIndividualOOP - memberStates[usageEvent.memberId].oopUsed;
      
      // Update member state with capped cost
      memberStates[usageEvent.memberId].oopUsed = cappedIndividualOOP;
      
      // Update family states with capped member cost
      familyState.deductibleUsed += eventResult.appliedToFamilyDeductible;
      familyState.rxDeductibleUsed += eventResult.appliedToRxDeductible;
      familyState.oopUsed += actualMemberCost;
      
      // Calculate cumulative totals
      const currentMonth = Math.floor(usageEvent.day / 30.4);
      const cumulativePremium = monthlyPremium * (currentMonth + 1);
      
      // Apply family OOP maximum
      const familyOOPMax = plan.familyOOPMax || plan.individualOOPMax * 2 || Infinity;
      const cappedFamilyOOP = Math.min(familyState.oopUsed, familyOOPMax);
      const cumulativeTotal = cumulativePremium + cappedFamilyOOP;
      
      // Debug logging for OOP max application
      if (actualMemberCost < eventResult.memberCost) {
        console.log(`🔒 Individual OOP max applied: Member ${usageEvent.memberName} cost reduced from $${eventResult.memberCost} to $${actualMemberCost} (limit: $${individualOOPMax})`);
      }
      if (cappedFamilyOOP < familyState.oopUsed) {
        console.log(`🔒 Family OOP max applied: Family cost capped at $${cappedFamilyOOP} (limit: $${familyOOPMax})`);
      }
      
      // Create progression row
      const progressionRow = {
        // Original usage event data
        day: usageEvent.day,
        memberId: usageEvent.memberId,
        memberName: usageEvent.memberName,
        eventType: usageEvent.eventType,
        serviceType: usageEvent.serviceType,
        medicationName: usageEvent.medicationName,
        tier: usageEvent.tier,
        grossCost: usageEvent.grossCost,
        
        // Plan-specific calculations
        eventCost: actualMemberCost,
        cumulativePremium: cumulativePremium,
        cumulativeOOP: cappedFamilyOOP,
        cumulativeTotal: cumulativeTotal,
        familyDeductibleUsed: familyState.deductibleUsed,
        familyRxDeductibleUsed: familyState.rxDeductibleUsed,
        familyOOPUsed: familyState.oopUsed,
        
        // Individual member state
        individualDeductibleUsed: memberStates[usageEvent.memberId].deductibleUsed,
        individualOOPUsed: memberStates[usageEvent.memberId].oopUsed,
        
        // Plan details for reference
        planId: plan.id,
        planName: plan.name,
        monthlyPremium: monthlyPremium,
        coverageType: coverageType
      };
      
      progression.push(progressionRow);
    }
    
    console.log(`✅ Applied ${plan.name} rules to ${progression.length} events`);
    return progression;
  }

  // Process individual event under plan rules
  processEventUnderPlan(plan, usageEvent, familyState, memberStates) {
    const memberState = memberStates[usageEvent.memberId];
    
    if (usageEvent.eventType === 'medical') {
      return this.processMedicalEventUnderPlan(plan, usageEvent, familyState, memberState);
    } else if (usageEvent.eventType === 'medication') {
      return this.processMedicationEventUnderPlan(plan, usageEvent, familyState, memberState);
    }
    
    return {
      memberCost: 0,
      appliedToFamilyDeductible: 0,
      appliedToIndividualDeductible: 0,
      appliedToRxDeductible: 0
    };
  }

  // Process medical event under plan rules
  processMedicalEventUnderPlan(plan, usageEvent, familyState, memberState) {
    const familyDeductible = plan.familyDeductible || plan.individualDeductible * 2 || 0;
    const individualDeductible = plan.individualDeductible || 0;
    
    const remainingFamilyDeductible = Math.max(0, familyDeductible - familyState.deductibleUsed);
    const remainingIndividualDeductible = Math.max(0, individualDeductible - memberState.deductibleUsed);
    const effectiveDeductible = Math.min(remainingFamilyDeductible, remainingIndividualDeductible);
    
    let memberCost = 0;
    let appliedToFamilyDeductible = 0;
    let appliedToIndividualDeductible = 0;
    
    // Apply deductible first
    if (effectiveDeductible > 0) {
      const appliedToDeductible = Math.min(usageEvent.grossCost, effectiveDeductible);
      memberCost += appliedToDeductible;
      appliedToFamilyDeductible = appliedToDeductible;
      appliedToIndividualDeductible = appliedToDeductible;
      
      // Calculate post-deductible costs
      const remainingCost = usageEvent.grossCost - appliedToDeductible;
      if (remainingCost > 0) {
        const postDeductibleCost = this.calculatePostDeductibleCost(plan, usageEvent.serviceType, remainingCost);
        memberCost += postDeductibleCost;
      }
    } else {
      // Deductible already met - use copays/coinsurance
      memberCost = this.calculatePostDeductibleCost(plan, usageEvent.serviceType, usageEvent.grossCost);
    }
    
    return {
      memberCost,
      appliedToFamilyDeductible,
      appliedToIndividualDeductible,
      appliedToRxDeductible: 0
    };
  }

  // Process medication event under plan rules
  processMedicationEventUnderPlan(plan, usageEvent, familyState, memberState) {
    const rxDeductible = plan.rxDeductible || 0;
    const hasSeperateRxDeductible = rxDeductible > 0;
    
    let memberCost = 0;
    let appliedToRxDeductible = 0;
    let appliedToFamilyDeductible = 0;
    let appliedToIndividualDeductible = 0;
    
    if (hasSeperateRxDeductible) {
      // PPO-style separate Rx deductible
      const remainingRxDeductible = Math.max(0, rxDeductible - familyState.rxDeductibleUsed);
      
      if (remainingRxDeductible > 0 && usageEvent.grossCost > 0) {
        const appliedToDeductible = Math.min(usageEvent.grossCost, remainingRxDeductible);
        memberCost += appliedToDeductible;
        appliedToRxDeductible = appliedToDeductible;
        
        const remainingCost = usageEvent.grossCost - appliedToDeductible;
        if (remainingCost > 0) {
          memberCost += this.calculateTierCost(plan, usageEvent.tier, remainingCost);
        }
      } else {
        // Rx deductible met or no cost, apply tier pricing
        memberCost = this.calculateTierCost(plan, usageEvent.tier, usageEvent.grossCost);
      }
    } else {
      // HSA-style unified deductible
      const familyDeductible = plan.familyDeductible || plan.individualDeductible * 2 || 0;
      const individualDeductible = plan.individualDeductible || 0;
      
      const remainingFamilyDeductible = Math.max(0, familyDeductible - familyState.deductibleUsed);
      const remainingIndividualDeductible = Math.max(0, individualDeductible - memberState.deductibleUsed);
      const effectiveDeductible = Math.min(remainingFamilyDeductible, remainingIndividualDeductible);
      
      if (effectiveDeductible > 0 && usageEvent.grossCost > 0) {
        const appliedToDeductible = Math.min(usageEvent.grossCost, effectiveDeductible);
        memberCost += appliedToDeductible;
        appliedToFamilyDeductible = appliedToDeductible;
        appliedToIndividualDeductible = appliedToDeductible;
        
        const remainingCost = usageEvent.grossCost - appliedToDeductible;
        if (remainingCost > 0) {
          memberCost += this.calculateTierCost(plan, usageEvent.tier, remainingCost);
        }
      } else {
        // Deductible met or no cost, apply tier pricing
        memberCost = this.calculateTierCost(plan, usageEvent.tier, usageEvent.grossCost);
      }
    }
    
    return {
      memberCost,
      appliedToFamilyDeductible,
      appliedToIndividualDeductible,
      appliedToRxDeductible
    };
  }

  // Calculate post-deductible cost for medical services
  calculatePostDeductibleCost(plan, serviceType, cost) {
    const copay = this.getCopayForService(plan, serviceType);
    
    if (copay && copay > 0) {
      // PPO: Use copay, but never more than the actual service cost
      return Math.min(copay, cost);
    } else {
      // HSA or no copay defined: Use coinsurance
      return cost * (plan.coinsurance || 0);
    }
  }

  // Get copay for specific service type
  getCopayForService(plan, serviceType) {
    const copayMap = {
      'primaryVisit': plan.primaryCopay,
      'specialistVisit': plan.specialistCopay,
      'therapySession': plan.mentalHealthCopay || plan.primaryCopay
    };
    return copayMap[serviceType] || 0;
  }

  // Calculate tier-based medication cost with proper type handling
  calculateTierCost(plan, tier, cost) {
    // Handle $0 cost medications
    if (cost === 0) {
      return 0;
    }
    
    const tierKeys = {
      1: 'tier1DrugCost',
      2: 'tier2DrugCost', 
      3: 'tier3DrugCost',
      4: 'specialtyDrugCost'
    };

    const tierCostKey = tierKeys[tier] || 'tier1DrugCost';
    const tierCost = plan[tierCostKey] || 0;
    const tierCostType = plan[`${tierCostKey}Type`];
    
    // Use explicit type information if available
    if (tierCostType === 'coinsurance') {
      // Percentage coinsurance - ensure proper decimal format
      const coinsuranceRate = tierCost > 1 ? tierCost / 100 : tierCost; // Handle both 20 and 0.2
      return cost * coinsuranceRate;
    } else if (tierCostType === 'copay') {
      // Fixed copay - never more than actual drug cost
      return Math.min(tierCost, cost);
    } else {
      // Legacy fallback - use old heuristic (for plans without type info)
      if (typeof tierCost === 'number' && tierCost < 1) {
        // Percentage coinsurance (HSA plans)
        return cost * tierCost;
      } else {
        // Fixed copay (PPO plans) - but only for actual cost
        return Math.min(tierCost, cost);
      }
    }
  }

  // Phase 3: Generate plan result summary from progression
  generatePlanResult(plan, progression, members) {
    if (progression.length === 0) {
      return this.createErrorResult(plan, new Error('No progression data'));
    }

    // Get final totals from last progression row
    const finalRow = progression[progression.length - 1];
    
    // Calculate member-specific results
    const memberResults = {};
    for (const member of members) {
      const memberEvents = progression.filter(row => row.memberId === member.id);
      const memberMedicalCosts = memberEvents
        .filter(e => e.eventType === 'medical')
        .reduce((sum, e) => sum + e.eventCost, 0);
      const memberRxCosts = memberEvents
        .filter(e => e.eventType === 'medication')
        .reduce((sum, e) => sum + e.eventCost, 0);
      
      memberResults[member.id] = {
        memberId: member.id,
        memberName: member.name,
        medicalCosts: memberMedicalCosts,
        rxCosts: memberRxCosts,
        totalCosts: memberMedicalCosts + memberRxCosts,
        events: memberEvents.map(e => ({
          day: e.day,
          type: e.eventType,
          serviceType: e.serviceType,
          cost: e.grossCost,
          memberCost: e.eventCost,
          appliedToDeductible: e.appliedToFamilyDeductible || 0
        }))
      };
    }

    // Calculate totals
    const totalMedicalCosts = progression
      .filter(row => row.eventType === 'medical')
      .reduce((sum, row) => sum + row.eventCost, 0);
    
    const totalRxCosts = progression
      .filter(row => row.eventType === 'medication')
      .reduce((sum, row) => sum + row.eventCost, 0);

    // Generate monthly accumulation from progression
    const monthlyAccumulation = this.generateMonthlyAccumulation(progression);
    
    // Generate milestones from progression
    const milestones = this.generateMilestones(plan, progression);

    const result = {
      planId: plan.id,
      planName: plan.name || 'Unnamed Plan',
      insurer: plan.insurer || 'Unknown',
      annualPremium: finalRow.monthlyPremium * 12,
      memberResults: memberResults,
      familyTotals: {
        medicalCosts: totalMedicalCosts,
        rxCosts: totalRxCosts,
        totalOutOfPocket: finalRow.cumulativeOOP,
        totalWithPremiums: finalRow.cumulativeTotal
      },
      scenarios: {}, // TODO: Implement scenarios
      timeline: progression.map(row => ({
        day: row.day,
        memberId: row.memberId,
        memberName: row.memberName,
        type: row.eventType,
        serviceType: row.serviceType,
        medicationName: row.medicationName,
        tier: row.tier,
        cost: row.grossCost
      })),
      monthlyAccumulation: monthlyAccumulation,
      milestones: milestones,
      coverageType: finalRow.coverageType,
      monthlyPremium: finalRow.monthlyPremium,
      planDetails: {
        individualDeductible: plan.individualDeductible || 0,
        familyDeductible: plan.familyDeductible || 0,
        individualOOPMax: plan.individualOOPMax || 0,
        familyOOPMax: plan.familyOOPMax || 0,
        coinsurance: plan.coinsurance || 0,
        primaryCopay: plan.primaryCopay || 0,
        specialistCopay: plan.specialistCopay || 0,
        rxDeductible: plan.rxDeductible || 0,
        tier1DrugCost: plan.tier1DrugCost || 0,
        tier2DrugCost: plan.tier2DrugCost || 0,
        tier3DrugCost: plan.tier3DrugCost || 0,
        specialtyDrugCost: plan.specialtyDrugCost || 0
      }
    };
    
    console.log(`✅ Plan ${plan.name} calculation complete:`);
    console.log(`   Annual Premium: $${result.annualPremium}`);
    console.log(`   Total Out-of-Pocket: $${result.familyTotals.totalOutOfPocket}`);
    console.log(`   Total With Premiums: $${result.familyTotals.totalWithPremiums}`);
    
    return result;
  }

  // Generate monthly accumulation from progression data
  generateMonthlyAccumulation(progression) {
    const monthlyData = Array(12).fill(0).map((_, i) => ({ 
      month: i + 1, 
      totalCost: 0, 
      events: 0 
    }));

    for (const row of progression) {
      const month = Math.floor(row.day / 30.4);
      if (month < 12) {
        monthlyData[month].totalCost = row.cumulativeOOP;
        monthlyData[month].events += 1;
      }
    }

    return monthlyData;
  }

  // Generate milestones from progression data
  generateMilestones(plan, progression) {
    const milestones = [];
    const familyDeductible = plan.familyDeductible || plan.individualDeductible * 2 || 0;
    const familyOOPMax = plan.familyOOPMax || plan.individualOOPMax * 2 || Infinity;
    
    let deductibleMet = false;
    let oopMaxMet = false;
    
    for (const row of progression) {
      if (!deductibleMet && row.familyDeductibleUsed >= familyDeductible) {
        milestones.push({
          type: 'family_deductible_met',
          day: row.day,
          amount: familyDeductible,
          description: `Family deductible of $${familyDeductible} met on day ${row.day}`
        });
        deductibleMet = true;
      }
      
      if (!oopMaxMet && row.familyOOPUsed >= familyOOPMax) {
        milestones.push({
          type: 'family_oop_met',
          day: row.day,
          amount: familyOOPMax,
          description: `Family out-of-pocket maximum of $${familyOOPMax} met on day ${row.day}`
        });
        oopMaxMet = true;
      }
    }
    
    return milestones;
  }

  // Phase 3: Export progression data as CSV
  exportCalculationWorksheets() {
    if (!this.lastUsageTable || !this.lastPlanProgressions) {
      console.warn('No progression data available to export');
      return null;
    }

    try {
      const csvContent = this.generateProgressionCSV();
      
      // Create downloadable CSV file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `health-plan-calculation-audit-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('📊 Calculation audit CSV exported successfully');
      return { success: true, type: 'csv' };
    } catch (error) {
      console.error('Failed to generate CSV export:', error);
      return null;
    }
  }

  // Generate CSV from progression data
  generateProgressionCSV() {
    const planIds = Object.keys(this.lastPlanProgressions);
    if (planIds.length === 0) return '';

    // Get member list from first plan progression
    const firstProgression = this.lastPlanProgressions[planIds[0]];
    const memberIds = [...new Set(firstProgression.map(row => row.memberId))];
    const memberNames = [...new Set(firstProgression.map(row => row.memberName))];

    // CSV Headers
    const headers = [
      'Day',
      'Date_Approx',
      'Member_ID', 
      'Member_Name',
      'Event_Type',
      'Service_Type',
      'Gross_Cost'
    ];

    // Add plan-specific columns for each plan
    planIds.forEach(planId => {
      const planProgression = this.lastPlanProgressions[planId];
      const planName = this.cleanColumnName(planProgression[0].planName);
      
      headers.push(
        `${planName}_Event_Cost`,
        `${planName}_Cum_Premium`,
        `${planName}_Cum_OOP`,
        `${planName}_Cum_Total`,
        `${planName}_Family_Deductible_Used`,
        `${planName}_Family_OOP_Used`
      );
      
      // Add individual member columns
      memberIds.forEach(memberId => {
        const memberName = this.cleanColumnName(memberNames[memberIds.indexOf(memberId)]);
        headers.push(`${planName}_${memberName}_Individual_Deductible_Used`);
        headers.push(`${planName}_${memberName}_Individual_OOP_Used`);
      });
    });

    const csvRows = [headers.join(',')];

    // Process usage table chronologically
    for (const usageEvent of this.lastUsageTable) {
      const row = [
        usageEvent.day,
        this.dayToApproximateDate(usageEvent.day),
        usageEvent.memberId,
        usageEvent.memberName,
        usageEvent.eventType,
        usageEvent.serviceType || usageEvent.medicationName || 'Unknown',
        usageEvent.grossCost || 0
      ];

      // Add data for each plan
      planIds.forEach(planId => {
        const progression = this.lastPlanProgressions[planId];
        const matchingRow = progression.find(p => 
          p.day === usageEvent.day && 
          p.memberId === usageEvent.memberId &&
          p.eventType === usageEvent.eventType &&
          (p.serviceType === usageEvent.serviceType || p.medicationName === usageEvent.medicationName)
        );

        if (matchingRow) {
          row.push(
            matchingRow.eventCost || 0,
            Math.round(matchingRow.cumulativePremium || 0),
            Math.round(matchingRow.cumulativeOOP || 0),
            Math.round(matchingRow.cumulativeTotal || 0),
            Math.round(matchingRow.familyDeductibleUsed || 0),
            Math.round(matchingRow.familyOOPUsed || 0)
          );

          // Add member-specific data
          memberIds.forEach(memberId => {
            if (memberId === usageEvent.memberId) {
              row.push(Math.round(matchingRow.individualDeductibleUsed || 0));
              row.push(Math.round(matchingRow.individualOOPUsed || 0));
            } else {
              // Find the state for other members at this point in time
              const otherMemberRow = progression
                .filter(p => p.memberId === memberId && p.day <= usageEvent.day)
                .slice(-1)[0]; // Last row for this member up to this day
              
              row.push(Math.round(otherMemberRow?.individualDeductibleUsed || 0));
              row.push(Math.round(otherMemberRow?.individualOOPUsed || 0));
            }
          });
        } else {
          // No matching row - fill with zeros
          const zeroCount = 6 + (memberIds.length * 2);
          for (let i = 0; i < zeroCount; i++) {
            row.push(0);
          }
        }
      });

      csvRows.push(row.join(','));
    }

    return csvRows.join('\n');
  }

  // Helper functions
  cleanColumnName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  }

  dayToApproximateDate(day) {
    const date = new Date(2024, 0, 1); // Start of year
    date.setDate(date.getDate() + day - 1);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  }

  determinePremiumTier(plan, members) {
    const memberCount = members.length;
    
    if (memberCount === 1) {
      return {
        coverageType: 'individual',
        monthlyPremium: plan.monthlyPremium || 0
      };
    }
    
    if (memberCount === 2) {
      // Check if it's employee + spouse (both adults)
      const hasChildren = members.some(m => m.relationship === 'child' || m.age < 18);
      
      if (!hasChildren && plan.spousePremium) {
        return {
          coverageType: 'employee+spouse',
          monthlyPremium: plan.spousePremium
        };
      }
    }
    
    // Family coverage (3+ members or 2 with children, or fallback)
    return {
      coverageType: 'family',
      monthlyPremium: plan.familyPremium || plan.monthlyPremium || 0
    };
  }

  addComparisonMetrics(results) {
    const planIds = Object.keys(results);
    if (planIds.length === 0) return;

    // Find best and worst plans
    const sortedByTotal = planIds.sort((a, b) => 
      results[a].familyTotals.totalWithPremiums - results[b].familyTotals.totalWithPremiums
    );
    
    const bestPlanId = sortedByTotal[0];
    const worstPlanId = sortedByTotal[sortedByTotal.length - 1];
    
    // Add comparison metrics to each plan
    for (const planId of planIds) {
      const result = results[planId];
      const bestResult = results[bestPlanId];
      
      result.comparison = {
        isBest: planId === bestPlanId,
        isWorst: planId === worstPlanId,
        savingsVsBest: result.familyTotals.totalWithPremiums - bestResult.familyTotals.totalWithPremiums,
        percentageMoreThanBest: ((result.familyTotals.totalWithPremiums - bestResult.familyTotals.totalWithPremiums) / bestResult.familyTotals.totalWithPremiums) * 100,
        rank: sortedByTotal.indexOf(planId) + 1
      };
    }
  }

  createErrorResult(plan, error) {
    return {
      planId: plan.id,
      planName: plan.name || 'Unnamed Plan',
      error: error.message,
      annualPremium: (plan.monthlyPremium || 0) * 12,
      familyTotals: {
        totalWithPremiums: 0,
        totalOutOfPocket: 0,
        medicalCosts: 0,
        rxCosts: 0
      },
      comparison: {
        isBest: false,
        isWorst: true,
        savingsVsBest: Infinity,
        rank: 999
      }
    };
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  // Validate and normalize plan data - handle valid variations, fail on corruption
  validateAndNormalizePlan(plan) {
    if (!plan || typeof plan !== 'object') {
      throw new Error('Plan data must be an object');
    }

    if (!plan.id) {
      throw new Error(`Plan missing required ID field: ${JSON.stringify(plan)}`);
    }

    if (!plan.name) {
      throw new Error(`Plan ${plan.id} missing required name field`);
    }

    // Create normalized plan with required fields
    const normalized = {
      id: plan.id,
      name: plan.name,
      insurer: plan.insurer || 'Unknown',
      planType: plan.planType || 'PPO'
    };

    // Validate and normalize numeric fields
    const numericFields = [
      'monthlyPremium', 'spousePremium', 'familyPremium',
      'individualDeductible', 'familyDeductible', 
      'individualOOPMax', 'familyOOPMax',
      'primaryCopay', 'specialistCopay',
      'rxDeductible', 'tier1DrugCost', 'tier2DrugCost', 
      'tier3DrugCost', 'specialtyDrugCost'
    ];

    for (const field of numericFields) {
      if (plan[field] !== undefined && plan[field] !== null && plan[field] !== '') {
        const value = parseFloat(plan[field]);
        if (isNaN(value)) {
          throw new Error(`Plan ${plan.id}: Invalid numeric value for ${field}: ${plan[field]}`);
        }
        if (value < 0) {
          console.warn(`⚠️ Plan ${plan.id}: Negative value for ${field}: ${value}`);
        }
        normalized[field] = value;
      } else {
        normalized[field] = 0;
      }
    }

    // Handle coinsurance - support both simple number and object structure
    if (plan.coinsurance !== undefined && plan.coinsurance !== null) {
      if (typeof plan.coinsurance === 'number') {
        // Simple number format
        normalized.coinsurance = plan.coinsurance;
      } else if (typeof plan.coinsurance === 'object' && plan.coinsurance.medical !== undefined) {
        // Object format with medical field
        const medicalCoins = parseFloat(plan.coinsurance.medical);
        if (isNaN(medicalCoins)) {
          throw new Error(`Plan ${plan.id}: Invalid coinsurance.medical value: ${plan.coinsurance.medical}`);
        }
        normalized.coinsurance = medicalCoins;
        console.log(`📋 Plan ${plan.id}: Using coinsurance.medical (${medicalCoins}) from object structure`);
      } else {
        throw new Error(`Plan ${plan.id}: Invalid coinsurance structure: ${JSON.stringify(plan.coinsurance)}`);
      }
    } else {
      normalized.coinsurance = 0;
    }

    // Preserve drug cost type information if available
    const typeFields = ['tier1DrugCostType', 'tier2DrugCostType', 'tier3DrugCostType', 'specialtyDrugCostType'];
    for (const field of typeFields) {
      if (plan[field]) {
        normalized[field] = plan[field];
      }
    }

    // Extract rxDeductible from networkType description if missing but described
    if (!normalized.rxDeductible && plan.networkType && typeof plan.networkType === 'string') {
      const rxMatch = plan.networkType.match(/prescription drugs - \$(\d+)/i);
      if (rxMatch) {
        normalized.rxDeductible = parseFloat(rxMatch[1]);
        console.log(`📋 Plan ${plan.id}: Extracted rxDeductible from description: $${normalized.rxDeductible}`);
      }
    }

    return normalized;
  }

  // Validate family data - fail loudly on corruption
  validateFamilyData(familyData) {
    if (!familyData.members || !Array.isArray(familyData.members)) {
      throw new Error('Family data must have a members array');
    }

    const validatedMembers = familyData.members.map((member, index) => {
      if (!member || typeof member !== 'object') {
        throw new Error(`Family member ${index} is not a valid object`);
      }

      if (!member.id) {
        throw new Error(`Family member ${index} missing required ID`);
      }

      // Check for corruption: field names like "medications[0].name" at member level
      const suspiciousFields = Object.keys(member).filter(key => key.includes('[') && key.includes(']'));
      if (suspiciousFields.length > 0) {
        throw new Error(`🚨 CORRUPT DATA DETECTED in member ${member.name || member.id}: Found corrupted fields: ${suspiciousFields.join(', ')}. This indicates a data storage bug that must be fixed at the source.`);
      }

      const validated = {
        id: member.id,
        name: member.name || 'Unknown',
        relationship: member.relationship || 'other',
        age: parseInt(member.age) || 35,
        isActive: member.isActive !== false,
        medications: []
      };

      // Validate numeric usage fields
      const usageFields = ['primaryVisits', 'specialistVisits', 'therapyVisits', 'labWork', 'imaging', 'physicalTherapy'];
      for (const field of usageFields) {
        const value = parseInt(member[field]);
        if (isNaN(value) || value < 0) {
          console.warn(`⚠️ Member ${member.name}: Invalid ${field} value: ${member[field]}, using 0`);
          validated[field] = 0;
        } else {
          validated[field] = value;
        }
      }

      // Validate medications
      if (member.medications && Array.isArray(member.medications)) {
        validated.medications = member.medications.map((med, medIndex) => {
          if (!med || typeof med !== 'object') {
            throw new Error(`Member ${member.name}: Medication ${medIndex} is not a valid object`);
          }

          const validatedMed = {
            id: med.id || `med_${Date.now()}_${medIndex}`,
            name: med.name || '',
            tier: parseInt(med.tier) || 1,
            monthlyCost: parseFloat(med.monthlyCost) || 0,
            quantity: parseInt(med.quantity) || 1
          };

          // Validate medication values
          if (validatedMed.tier < 1 || validatedMed.tier > 4) {
            console.warn(`⚠️ Member ${member.name}: Invalid medication tier ${validatedMed.tier}, using tier 1`);
            validatedMed.tier = 1;
          }

          if (validatedMed.monthlyCost < 0) {
            console.warn(`⚠️ Member ${member.name}: Negative medication cost ${validatedMed.monthlyCost}, using 0`);
            validatedMed.monthlyCost = 0;
          }

          return validatedMed;
        });
      }

      return validated;
    });

    return {
      members: validatedMembers,
      serviceCosts: familyData.serviceCosts || {}
    };
  }
}