# v2 Feedback

Notes from testing the v2 Ledger Method CLI on a real project. Free-form — jot things down as
you hit them, clean up later if needed. See `docs/v2-testing-guide.md` for the command walkthrough
this testing pass follows.

## Shortcomings / friction

1. Here the dash board is built right after the commit command. It would be better to build/update the dash board after the following commands:
 - `ledger init`
 - `ledger list-features "<brain dump: what is this project, what are its main pieces>"` 
 - `ledger add-feature <name> "<description>" --group <group-name>`
2. I am making a Sudoku app. The features are all grouped automatically. It would be better if this didn't happen by default and if all are un-grouped from the begining and the user groups them himself. 
3. But when showing the features it would be better to show them in the order of implementation from simplest to hardest.
3. We have this command `ledger set-group <feature>` where if we don't give the name it will be taken from the group. The same way for this command `ledger rename-group <old-group-name> <new-group-name>` if we give the `<new-group-name>` as empty it should take the features out of that group. 
4. When a new version is create for a feature it would be better to have a fresh files for the second version. Like when I started a new version the logic.md file was clean and it was written what version it was. It would be good to have the brain dump file fresh also but indicating which version it is. Like in the logic.md file there is a front end matter. So it would be nice for that front end matter to be shown in the brain-dump.md file and for the brain-dump.md file to be clean since when I started the new version it had the brain dump from the pervious version. 
5. For the testing stage it created the automated and manual test. No issues here. 
    - But there is no instruction on how to run the automated test and after running the automatic test, those tests should be marked as done in the test.md file. 
    - We have a check list of manual test. But there is no instruction on what should be written next to the check box '[]'
6. In the errors.md file it would be better if we updated the command as follows: `log-error <feature> ["error output of termina"] ["user description of what the error is and where it happende"]` 
7. When resolving the errror, it would be better if we can resolve it from the error.md file itself using another command like `fix-error <feature> [--id <n>]` which forces the agent to fix the error. If the ID is not provided then it makes the agent fix all the error (or the latest one) depending on which is easier to implement. When I got the error on my project I had to open another terminal and use Claude there to help me fix it. It would be better if we can do everything in just one terminal. 

## Bugs

1. If the user has a lot to write in the logic stage, wouldn't it be better to make them write that in the file instead of on the terminal. Is this possible in the current version. Because I don't seen an option to. 
 - It would be better to use the command `ledger draft logic <feature> "<your raw thinking on how this should work>"` when the brain dump is small. 
 - But if it is big, it would be better to do append the brain dump at the end of the 'brain-dump.md' file and let the AI read the latest brain dump from it using a command like `ledger draft logic <feature> --file` or something so that it knows to read the 'brain-dump.md' file to read the latest brain dump.
2. I wanted to see the previous version of the logic.md file. Though the folder is empty (as I started a new version) I wasn't able to view the content in the dashbaord also. When I view click on logic, it doesn't show anything regarding the logic of the previous version.
3. When the steps are created it would be better to have at least the brain-dump.md, sketch.md, test-outline.md etc already generated. This is generated for brain-dump.md but it would be better if these files where the user gives a rough idea is done for other stages also. Since when drafting the code, if the code is big, it would be better for them to write the sample code in the sketch.md file and run it like `ledger draft code <feature> --file`, similar to point 1.
4. I got this error once when I ran the command `ledger draft code` - 'AI provider did not return parseable JSON: Unterminated string in JSON at position 16753 (line 1 column 16754)'. When I ran the command again, it worked. But make sure this does't happen again. 

## Ideas for later

1. Would it be possible to make the dash board interactive where the user can hide/minimize the steps of the featuers and see only the heading so that he/she can focus on the feature that is important at the moment and not see the full set of features. 
2. Is it possible to drag the features around so that he can arrage the order of the features on the dashboard. Is it possible to do this with the groups also? This is just a visual representation to make ordering and flow easier. 
3. Errors can happen during testing. So should the log error have a flag that shows where the error occured - in the code or on the test. 

## Design questions (need author decision)

-
