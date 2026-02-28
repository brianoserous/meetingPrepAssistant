

### Meeting Prep Assistant

GitHub URL https://github.com/brianoserous/oxfordUniversity

##### Introduction



Firstly, I chose to build this application directly into Google AI Studio as opposed to creating separate Gems and Screens to import.  I did this because I'd already used the Gems screens and because I already felt comfortable using the build facility directly in Google AI Studio.



I passed a fairly detailed user prompt as detailed below.  I feel that it was clear enough to allow the Studio to create the accurate \& required user interface and application logic.  There were a couple of application bugs created by google studio which I had to prompt to ask the system to fix.  In addition, I provided a further prompt to enforce structured output formatting in JSON.  I have included the prompts here in text, along with pointers to the accompanying screenshots in this folder and have numbered in order of execution.



Aside from the additional prompt for structured formatting I didn't find the need for fine tuning via prompt to address 'model behaviour' so I've been somewhat limited in demonstrating an iterative prompting of the design or the behaviour.  The default model supplied worked perfectly, and since I've given the system some synthetic meeting minutes and topics, I have not detected hallucination / drift which needed addressing.  



Again, due to the synthetic data and limited testing, I have not been able to build any critical analysis around trade-off of the models save for the change of model simply due to availability in the ecosystem I detailed below.

Please note that I have included the synthetic source material in the folder /sample_notes_and_slides.







1. My initial prompt was



'*Please create a web based application called 'Meeting Prep Assistant'.  This application should prepare structured meeting intelligence as a result of the input provided by the user.*



*The user should input a Notes PDF and presentation slides. Outputs must include meeting summary, risk identification, key talking points, next steps, and a cover image prompt.*



*Can you please create a working user interface. Which has an 'upload' and a 'create summary' feature.*

\*1. The Upload feature should allow the user to import multiple files and file types including the Notes PDF as well as presentation slides, and other content type.\* 

	\*2. The Create Summary Feature will process the content which has been uploaded produce the output summary as defined below.\*






*The output summary should be as per the following structure:*



\*Summary - a paragraph summary description of the meeting.  Presented as paragraph with bold Heading of 'Summary'\*

	\*Risks - a detailed bullet set of risks in priority order if that is possible. Presented with bold Heading of 'Risks'\*

	\*Talking Points - what are the key talking points proposed for the meeting. Presented with bold heading of 'Talking Points'\*

	\*Next Steps - a list of recommended next steps listed in text based bullet points. Presented with bold heading of 'Next Steps'.\*

	





*All content should be compiled into a single pdf file for download.  That pdf should also be displayed on the screen. The output should also include cover image shown at the top.*



*Please use the cheapest Gemini model you have so as to find the best trade off between app capability and cost.  Please show the cost of the app every time the user presses the 'create summary*

*'*



2\. I then downloaded the code and ran locally since my corporate laptop would not allow me to browse to the automated hosting environment created by Google AI Studio.



3\. After running locally, I got the error '*{"error":{"code":404,"message":"models/gemini-3-flash-lite-latest is not found for API version v1beta, or is not supported for generateContent. Call ListModels to see the list of available models and their supported methods.","status":"NOT\_FOUND"}}*'



I fed the above error back into Google AI studio and selected the proposed model which worked fine.



4\. I uploaded the latest code \& tested via AntiGravity -  but it now errored with

 	{"error":{"code":400,"message":"Unsupported MIME type: application/vnd.openxmlformats-officedocument.presentationml.presentation","status":"INVALID\_ARGUMENT"}}

 

I prompted Google Assist with the above error and it responded with a proposed fix to support a fixed set of filetypes.. Namely pdf and txt.  The application now works fine as per screenshots 1, 2 and 3.





5\. I then provided the following prompt to add a button to apply strict output formatting syntax as JSON formatted JIRA tickets.

 

*User*

*please replace the 'download pdf' button with the 'Download Next Steps into JIRA' which will display all the next steps as JSON formatted JIRA tickets with the format of fields: task\_name, assignee\_suggestion, priority\_level, due\_date\_estimate.*



*Google AI Assistant responded with*

*I have updated the application to replace the PDF download functionality with a structured JIRA Integration feature.*

*Key Changes:*

\*• Structured JIRA Output: The "Next Steps" section has been upgraded to generate detailed JIRA tickets. Each ticket now includes:\*

		\*○ Task Name: A concise title for the action item.\*

		\*○ Assignee Suggestion: An AI-suggested team member or role based on the meeting context.\*

		\*○ Priority Level: Categorized as Low, Medium, High, or Highest (with visual color coding).\*

		\*○ Due Date Estimate: A proposed timeline for completion.\*

	\*• JIRA JSON Download: Replaced the "Download PDF" button with a "Download Next Steps into JIRA" button. This downloads a machine-readable JSON file containing all the generated tickets, ready for import or integration with JIRA's API.\*

	\*• Enhanced UI: The "Next Steps" section now displays these tickets in a professional card-based layout, making it easy to review assignments and priorities at a glance.\*

	\*• Updated AI Logic: The Gemini prompt and response schema have been refined to ensure high-quality, structured data for every action item identified in your notes.\*










6\. The following screen shots 4 and 5 demonstrate the application output after that prompt



7\. In terms of model trade-offs, I was unable to really 

