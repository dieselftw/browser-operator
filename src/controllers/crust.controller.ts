import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { BrowserAutomation } from '../utils/BrowserAutomation';

export const interact = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const browser = new BrowserAutomation(process.env.GROQ_API_KEY || '');
  
  try {
    const { command } = req.body;

    if (!command) {
      res.status(400).json({ message: 'Please enter a valid command' });
      return;
    }
    
    // Initialize browser
    await browser.initialize();
    
    const results = [];
    let finalExtractedContent = null;
    const previousSteps = [];
    let maxSteps = 20; // Safety limit to prevent infinite loops
    let stepCount = 0;
    
    // Get initial page state
    let currentState = await browser.getPageState();
    
    while (stepCount < maxSteps) {
      stepCount++;
      
      // Generate next step based on current state
      const nextStep = await browser.generateNextStep(currentState, command, previousSteps);
      console.log(`\n--- Generated step ${stepCount}: ${nextStep} ---`);
      
      // Check if we've completed the goal
      if (nextStep === "GOAL_COMPLETED") {
        console.log("Goal completed successfully!");
        results.push({
          step: "GOAL_COMPLETED",
          status: "SUCCESS",
          message: "Goal completed successfully",
          url: currentState.url,
          title: currentState.title
        });
        break;
      }
      
      // Execute step with retries
      const stepResult = await browser.executeStepWithRetries(nextStep);
      
      // Update current state
      currentState = {
        url: stepResult.url,
        title: stepResult.title,
        html: stepResult.html
      };
      
      // End condition
      if(nextStep == "END") {
        // If this step extracted content, save it
        if ('extractedContent' in stepResult) {
          finalExtractedContent = stepResult.extractedContent;
        }
        break
      }
      // Store results
      results.push({
        step: nextStep,
        status: stepResult.verification.status,
        message: stepResult.verification.message,
        url: stepResult.url,
        title: stepResult.title
      });
      
      previousSteps.push(nextStep);

      
      // Take a screenshot after each step for debugging
      await browser.page.screenshot({ path: `step-${stepCount}-${Date.now()}.png` });
    }
    
    // Close browser
    await browser.close();
    
    // Return results
    res.status(200).json({
      command,
      results,
      extractedContent: finalExtractedContent,
      message: stepCount >= maxSteps ? 
        "Automation reached maximum step limit" : 
        "Automation completed successfully"
    });
    
  } catch (error) {
    await browser.close();
    console.error('Error in interact controller:', error);
    res.status(500).json({
      message: 'Error executing automation',
    });
  }
};
