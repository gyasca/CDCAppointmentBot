const puppeteer = require("puppeteer");
const readline = require("readline");

async function main() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Navigate to the appointment booking page
  await page.goto(
    "https://app.acuityscheduling.com/schedule.php?owner=20159891&appointmentType=15643979&template=monthly"
  );

  // Get the unavailable dates from the user
  const unavailableDates = await getUnavailableDatesFromUser();

  // Monitor the page for changes every 10 seconds
  while (true) {
    await page.reload();
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait for 10 seconds

    // Get the available dates
    const dateElements = await page.$$(".react-calendar__tile");
    let earliestAvailableDate = null;

    for (const dateElement of dateElements) {
      const dateText = await dateElement.$eval("abbr", (element) =>
        element.getAttribute("aria-label")
      );
      console.log(dateText);
      const dateParts = dateText.split(" ");
      const month = dateParts[0];
      const day = parseInt(dateParts[1]);
      const year = dateParts[2];

      // Check if the date is not in the unavailable dates
      if (!unavailableDates.includes(day.toString())) {
        // Check if the date button is clickable
        const isClickable = await dateElement.evaluate((element) => {
          return (
            element.disabled === false &&
            element.classList.contains("react-calendar__tile--disabled") ===
              false
          );
        });

        if (isClickable) {
          if (
            !earliestAvailableDate ||
            month + day <
              earliestAvailableDate.month + earliestAvailableDate.day
          ) {
            earliestAvailableDate = { month, day, year };
          }
        }
      }
    }

    if (earliestAvailableDate) {
      console.log(
        `Earliest available date: ${earliestAvailableDate.month} ${earliestAvailableDate.day}, ${earliestAvailableDate.year}`
      );

      const dateElement = await page.$(
        `.react-calendar__tile abbr[aria-label="${earliestAvailableDate.month} ${earliestAvailableDate.day}, ${earliestAvailableDate.year}"]`
      );
      if (dateElement) {
        console.log("Date element found, clicking...");
        await dateElement.click();

        // Wait for the time slots to load
        await page.waitForSelector(".css-12097oh");

        // Get the time slots
        const timeSlots = await page.$$(".css-12097oh");

        // Choose the earliest time slot
        const earliestTimeSlot = await timeSlots[0].$eval("p", (element) => {
          return element.textContent;
        });
        console.log(`Earliest available time: ${earliestTimeSlot}`);

        // Click on the earliest time slot
        const timeSlotButton = await page.$(
          `button.css-12097oh > p:contains(${earliestTimeSlot})`
        );
        if (timeSlotButton) {
          console.log("Time slot button found, clicking...");
          await timeSlotButton.click();
        } else {
          console.error("Time slot button not found");
        }
      } else {
        console.error("Date element not found");
      }
    } else {
      console.error("No earliest available date found");
    }
  }
}

// Function to get the unavailable dates from the user
async function getUnavailableDatesFromUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let unavailableDates = [];

  console.log('Enter the unavailable dates (DD/MM/YY), or "done" to finish:');
  return new Promise((resolve) => {
    rl.on("line", (answer) => {
      if (answer.toLowerCase() === "done") {
        rl.close();
        resolve(unavailableDates);
      } else {
        unavailableDates.push(answer.split("/")[0]);
        console.log('Enter the next date, or "done" to finish:');
      }
    });
  });
}

main();
