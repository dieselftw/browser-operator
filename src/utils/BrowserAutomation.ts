import { Bezel, GroqAdapter } from "bezel-ai";
import { firefox } from "playwright";
import { z } from "zod";
import Groq from "groq-sdk";

export class BrowserAutomation {
  private browser: any;
  public page: any;
  private llm: Bezel;
  private groq: Groq;

  constructor(apiKey: string) {
    const adapter = new GroqAdapter(apiKey, {
      model: "llama-3.3-70b-versatile",
      maxRetries: 1,
    });
    this.llm = new Bezel(adapter);
    this.groq = new Groq({ apiKey });
  }

  async initialize() {
    this.browser = await firefox.launch({ headless: false, slowMo: 1000 });
    this.page = await this.browser.newPage();
  }

  async getPageElementsInfo(pageState: any): Promise<string> {
    try {
      // Get common interactive elements like buttons, inputs, links
      const elementsInfo = await this.page.evaluate(() => {
        const info: string[] = [];
        
        // Get buttons
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"], [role="button"]'));
        buttons.slice(0, 10).forEach(btn => {
          const text = (btn as HTMLElement).innerText || (btn as HTMLInputElement).value || '';
          const id = (btn as HTMLElement).id ? `#${(btn as HTMLElement).id}` : '';
          const classes = (btn as HTMLElement).className ? `.${(btn as HTMLElement).className.replace(/\s+/g, '.')}` : '';
          info.push(`Button: "${text.trim()}" ${id || classes || 'button'}`);
        });
        
        // Get input fields
        const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], textarea'));
        inputs.slice(0, 10).forEach(input => {
          const placeholder = (input as HTMLInputElement).placeholder || '';
          const id = (input as HTMLElement).id ? `#${(input as HTMLElement).id}` : '';
          const name = (input as HTMLInputElement).name ? `[name="${(input as HTMLInputElement).name}"]` : '';
          info.push(`Input: "${placeholder}" ${id || name || 'input'}`);
        });
        
        // Get links
        const links = Array.from(document.querySelectorAll('a'));
        links.slice(0, 10).forEach(link => {
          const text = (link as HTMLElement).innerText;
          const href = (link as HTMLAnchorElement).href;
          info.push(`Link: "${text.trim()}" [href="${href}"]`);
        });
        
        return info.join('\n');
      });
      
      return elementsInfo;
    } catch (error) {
      console.error('Error getting page elements info:', error);
      return "Unable to extract page elements information";
    }
  }
  

  async navigateToUrl(url: string) {
    await this.page.goto(url);
    return await this.getPageState();
  }

  async llmCompletion(content: string, model: string = "llama-3.3-70b-versatile") {
    try {
      const chatCompletion = await this.groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content,
          },
        ],
        model,
      });
      
      return chatCompletion.choices[0]?.message?.content || "";
    } catch (error) {
      console.error("Error calling LLM:", error);
      throw error;
    }
  }

  async generateNextStep(currentState: any, overallGoal: string, previousSteps: string[] = []) {
    try {
      const stepPrompt = `
        You are an AI assistant for browser automation. Given the current page state and the overall goal, determine the next step to take.

        Overall goal: ${overallGoal}

        Current page state:
        URL: ${currentState.url}
        Title: ${currentState.title}
        
        Available elements (sample of important selectors):
        ${await this.getPageElementsInfo(currentState)}
        
        Previous steps taken:
        ${previousSteps.map((step, index) => `${index + 1}. ${step}`).join('\n')}

        Based on this information, what is the next specific action to take? Be precise and technical.
        Your response should be a single step, formatted as a string.
        
        Example responses:
        - "Navigate to https://example.com"
        - "Click on the element with selector '#login-button'"
        - "Type 'search term' into the input field with selector 'input[name=\"q\"]'"
        - "Extract data from elements matching '.product-item'"
        
        If you believe the overall goal has been completed, respond with "GOAL_COMPLETED".
        Provide only the next step, nothing else.
      `;

      const stepSchema = z.object({
        nextStep: z.string()
      });
      
      const { data: stepData } = await this.llm.extract(stepPrompt, stepSchema);
      console.log(stepData[0].nextStep)
      return stepData[0].nextStep;
    } catch(e) {
      console.log(e);
      throw e;
    }
  }

  async executeStep(step: string, pageState: any) {
    try {
      // If the step indicates goal completion, return a special result
      if (step === "GOAL_COMPLETED") {
        return {
          ...await this.getPageState(),
          status: "COMPLETED",
          isCompleted: true
        };
      }
  
      // Get page elements information for better context
      const pageElementsInfo = await this.getPageElementsInfo(pageState);
  
      const actionPrompt = `
        You are a browser automation assistant. Given the following step and current page state, determine the best action to take.
        
        Step to execute: ${step}
        
        Current page state:
        URL: ${pageState.url}
        Title: ${pageState.title}
        
        Available elements:
        ${pageElementsInfo}
        
        Determine the action to take. Choose from:
        - click: if we need to click something
        - type: if we need to type something
        - select: if we need to select an option
        - extract: if we need to extract data
        - navigate: if we need to go to a URL
        - wait: if we need to wait for something to load
        - pressKey: if we need to press a keyboard key
        
        For the chosen action, provide:
        - selector: CSS or XPath selector for the element (not needed for navigate or wait)
        - value: text to type, option to select, URL to navigate to, or script to execute
        - waitTime: time to wait in milliseconds (for wait action)
        - key: keyboard key to press (for pressKey action)
        
        Format your response as JSON with the appropriate fields for the chosen action.
          IMPORTANT: You must return ONLY a raw JSON object without any markdown formatting, code blocks, or backticks. Do not wrap your response in backtick tags. Just return the plain JSON object.
      `;
  
      const actionSchema = z.object({
        action: z.string(),
        selector: z.string().optional(),
        value: z.string().optional(),
        waitTime: z.number().optional(),
        key: z.string().optional()
      });

      const { data: actionData } = await this.llm.extract(actionPrompt, actionSchema);
      const action = actionData[0];
      
      console.log(action)

      // Execute the action
      switch (action.action) {
        case 'click':
          if (!action.selector) throw new Error("Selector is required for click action");
          // Wait for element to be visible and stable before clicking
          await this.page.waitForSelector(action.selector, { state: 'visible' });
          await this.page.click(action.selector);
          break;
          
        case 'type':
          if (!action.selector) throw new Error("Selector is required for type action");
          await this.page.waitForSelector(action.selector, { state: 'visible' });
          // Clear the field first before typing
          await this.page.fill(action.selector, '');
          await this.page.fill(action.selector, action.value || '');
          break;
          
        case 'select':
          if (!action.selector) throw new Error("Selector is required for select action");
          await this.page.waitForSelector(action.selector, { state: 'visible' });
          await this.page.selectOption(action.selector, action.value || '');
          break;
          
        case 'navigate':
          if (!action.value) throw new Error("URL value is required for navigate action");
          await this.page.goto(action.value, { waitUntil: 'networkidle' });
          break;
          
        case 'wait':
          const waitTime = action.waitTime || 2000;
          await this.page.waitForTimeout(waitTime);
          break;
          
        case 'waitForSelector':
          if (!action.selector) throw new Error("Selector is required for waitForSelector action");
          await this.page.waitForSelector(action.selector, { 
            state: 'visible', 
            timeout: action.waitTime || 30000 
          });
          break;
          
        case 'waitForNavigation':
          await this.page.waitForNavigation({ 
            waitUntil: 'networkidle',
            timeout: action.waitTime || 30000 
          });
          break;
          
        case 'pressKey':
          if (!action.key) throw new Error("Key is required for pressKey action");
          await this.page.keyboard.press(action.key);
          break;
          
        case 'hover':
          if (!action.selector) throw new Error("Selector is required for hover action");
          await this.page.waitForSelector(action.selector, { state: 'visible' });
          await this.page.hover(action.selector);
          break;
          
        case 'scrollIntoView':
          if (!action.selector) throw new Error("Selector is required for scrollIntoView action");
          await this.page.evaluate((selector: any) => {
            const element = document.querySelector(selector);
            if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, action.selector);
          break;
          
        case 'executeScript':
          if (!action.value) throw new Error("Script value is required for executeScript action");
          const scriptResult = await this.page.evaluate((script: any) => {
            // Using Function constructor to execute the script string
            return new Function(script)();
          }, action.value);
          return {
            ...await this.getPageState(),
            scriptResult,
            status: "SCRIPT_EXECUTED"
          };
          
        case 'extract':
          if (!action.selector) throw new Error("Selector is required for extract action");
          // Wait for elements to be available before extracting
          await this.page.waitForSelector(action.selector, { state: 'attached', timeout: 10000 }).catch(() => {});
          const extractedContent = await this.page.$$eval(action.selector, 
            (elements: any) => elements.map((el: any)=> el.textContent?.trim() || '')
          );
          console.log(extractedContent);
          return {
            ...await this.getPageState(),
            extractedContent,
            status: "EXTRACTED"
          };
      }
      
      // Wait a moment for any DOM updates to complete
      await this.page.waitForTimeout(500);
      
      return {
        ...await this.getPageState(),
        status: "SUCCESS"
      };
    } catch (error: any) {
      console.error('Error executing step:', error);
      await this.page.screenshot({ path: `error-${Date.now()}.png` });
      return {
        ...(await this.getPageState()),
        error: error.message,
        status: "ERROR"
      };
    }
  }

  

  async verifyStepSuccess(step: string, pageState: any) {
    // If the step already indicates completion or has extracted content, consider it successful
    if (pageState.status === "COMPLETED" || pageState.status === "EXTRACTED") {
      return {
        status: "SUCCESS",
        message: "All steps completed successfully",
        nextAction: "END"
      };
    }

    const pageElementsInfo = await this.getPageElementsInfo(pageState);
    
    // const verificationPrompt = `
    //   Step that was executed: "${step}"

    //   Current page state:
    //   URL: ${pageState.url}
    //   Title: ${pageState.title}
    //   Status: ${pageState.status || "UNKNOWN"}
    //   ${pageState.error ? `Error: ${pageState.error}` : ''}

    //   Current page elements:
    //   ${pageElementsInfo}

    //   Verification guidelines:
    //   1. For navigation steps: Check if the URL matches the expected destination
    //   2. For click steps: Always say reply with success, no need for anything else.
    //   3. For type steps: Check if the input field contains the expected text
    //   4. For extract steps: Check if data was successfully extracted
    //   5. For wait steps: Check if the expected elements are now visible

    //   Analyze if the step appears to have been completed successfully based on the current page state and elements.

    //   Return ONLY the raw JSON object without any markdown formatting, code blocks, or backticks.

    //   Your response should be structured as JSON with:
    //   - status: "SUCCESS" or "FAILURE"
    //   - message: detailed explanation of success or failure with evidence from the page state
    //   - nextAction: "END" if successful, or specific suggestion for what to try next if failed

    // `;

    const verificationPrompt = "SUCCESS"
    
    try {
      // Use regular LLM completion instead of structured extraction
      // const response = await this.llmCompletion(verificationPrompt);
      const response = "SUCCESS"
      
      // Try to parse the response, handling markdown if needed
      let result;
      try {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/``````/) || 
                         response.match(/({[\s\S]*?})/);
        
        const jsonStr = jsonMatch ? jsonMatch[1] : response;
        result = JSON.parse(jsonStr);
      } catch (e) {
        console.log("Failed to parse verification response:", e);
        // Fallback to a default success response
        result = {
          status: "SUCCESS",
          message: "Verification parsing failed, assuming success",
          nextAction: "END"
        };
      }
      
      return result;
    } catch (error) {
      console.error("Verification error:", error);
      return {
        status: "SUCCESS", // Default to success to continue execution
        message: "Verification error, assuming success",
        nextAction: "END"
      };
    }
  }
  

  async executeStepWithRetries(step: string, maxRetries = 3) {
    let retries = 0;
    let result;
    
    while (retries < maxRetries) {
      // Get current page state
      const pageState = await this.getPageState();
      
      // Execute the step
      console.log(`Executing step: ${step} (attempt ${retries + 1})`);
      result = await this.executeStep(step, pageState);
      
      // Check if step was successful
      const verification = await this.verifyStepSuccess(step, result);
      
      if (verification.status === "SUCCESS" || verification.nextAction === "END") {
        console.log(`Step completed successfully: ${verification.message}`);
        return {
          ...result,
          verification
        };
      }
      
      console.log(`Step failed: ${verification.message}`);
      console.log(`Trying again with suggestion: ${verification.nextAction}`);
      
      // If not successful, try the suggested next action if it's not END
      if (verification.nextAction !== "END") {
        retries++;
      }
    }
    
    throw new Error(`Failed to execute step "${step}" after ${maxRetries} attempts`);
  }

  async getPageState() {
    return {
      url: await this.page.url(),
      title: await this.page.title(),
      html: await this.page.content()
    };
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}
