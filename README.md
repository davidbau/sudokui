Sudokui
-------

A computer interface just can not match the satisfying experience
of solving a good Sudoku on pencil and paper.  Or can it?

Here you will try making an improved Sudoku UI, and then you will use
an A/B test to see how users react to your changes.

This app has a number of features that might be improved.

- Numbers are filled using two clicks: pick a number then a square.
- Holding the check button checks your work without explanation.
- Mobile usage works, but it is not comfortable.
- Keystrokes do not do anything.
- There is a timer, but no other extrinsic motivators.
- You can bookmark and sequence through puzzles, but no other navigation.
- Numbers can be made small with the undiscoverable ui of holding shift.

To measure your new version, you will be doing an A/B test, so you
will need to collect and analyze logs of user behavior.

Although app code works for traditional 9x9 boards (change Sudoku.init),
you should test your improved interface at 4x4 so that you can collect
more data in a limited amount of time.

This app includes some logging infrastructure for intercepting jQuery
events and sending data to a Google spreadsheet; you will need to
modify logging.js to log to your own spreadsheet.


MIT License
-----------

Portions copyright 2017 MIT,
portions copyright 2010 David Bau

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be included
in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
DEALINGS IN THE SOFTWARE.

