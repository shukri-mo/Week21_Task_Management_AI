import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extract and parse task data from AI response
 * @param {string} responseContent - Raw response from OpenAI
 * @returns {Object} Parsed task data with validation
 */
export function extractTaskFromAIResponse(responseContent) {
  try {
    if (!responseContent) {
      throw new Error("No response content provided");
    }

    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from AI");
    }

    // Parse the JSON response
    const taskData = JSON.parse(jsonMatch[0]);

    // Validate the required fields
    if (!taskData.title || !taskData.description) {
      throw new Error(
        "AI response missing required fields (title or description)"
      );
    }

    // Set default values if not provided
    const validatedTaskData = {
      title: taskData.title,
      description: taskData.description,
      priority: taskData.priority || "medium",
      status: taskData.status || "pending",
      subtasks: taskData.subtasks || [],
    };

    // Validate subtasks if they exist
    if (validatedTaskData.subtasks.length > 0) {
      validatedTaskData.subtasks = validatedTaskData.subtasks.map(
        (subtask, index) => {
          if (!subtask.title) {
            throw new Error(`Subtask ${index + 1} missing title`);
          }
          return {
            title: subtask.title,
            description: subtask.description || "",
            completed: subtask.completed || false,
          };
        }
      );
    }

    return validatedTaskData;
  } catch (error) {
    throw new Error(
      `Failed to extract task from AI response: ${error.message}`
    );
  }
}

/**
 * Generate task using OpenAI API
 * @param {string} prompt - User's task description
 * @returns {Object} Parsed and validated task data
 */
export async function generateTaskWithAI(prompt) {
  try {
    // 1. Check API key
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "Missing OpenAI API key. Please set OPENAI_API_KEY in your environment."
      );
    }

    // 2. System prompt (instructions for AI)
    const systemPrompt = `
      You are a task management assistant.
      Create a task based on the user's description.
      Always return ONLY valid JSON, with this structure:
      {
        "title": "string",
        "description": "string",
        "priority": "low | medium | high",
        "status": "pending | in-progress | completed",
        "subtasks": [
          {
            "title": "string",
            "description": "string",
            "completed": false
          }
        ]
      }
    `;

    // 3. User prompt (the task request)
    const userPrompt = `User's request: ${prompt}. Please return a JSON task object.`;

    // 4. Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    // 5. Extract response content
    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No content returned from AI.");
    }

    // 6. Parse & validate with helper
    const taskData = extractTaskFromAIResponse(responseContent);

    // 7. Return final task
    return taskData;
  } catch (error) {
    // 8. Handle errors
    throw new Error(`Failed to generate task with AI: ${error.message}`);
  }
}

