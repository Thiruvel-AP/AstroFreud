import smtplib
import ssl
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
import json
from config_loader import configLoader

def send_astro_email(recipient_email, file_path):
    # --- CONFIGURATION ---
    sender_email = "shankarnarayana92@gmail.com"
    app_password = "vncr rebk zbpe icof"
    body_html= "<h2>Emergency Report Attached</h2>"
    
    # Change to "mixed" to allow attachments
    message = MIMEMultipart("mixed")
    message["Subject"] = "AstroFreud: Emergency Report"
    message["From"] = f"AstroFreud AI <{sender_email}>"
    message["To"] = recipient_email

    # Create a container for the text/HTML parts
    body_container = MIMEMultipart("alternative")
    
    part1 = MIMEText("Please find the attached emergency report of the crew", "plain")
    body_container.attach(part1)
    
    if body_html:
        part2 = MIMEText(body_html, "html")
        body_container.attach(part2)
    
    # Attach the text container to the main message
    message.attach(body_container)

    # --- ATTACH PDF ---
    if file_path and os.path.exists(file_path):
        try:
            with open(file_path, "rb") as f:
                attachment = MIMEApplication(f.read(), _subtype="pdf")
            
            # Add the header so the email client knows it's a file
            filename = os.path.basename(file_path)
            attachment.add_header('Content-Disposition', 'attachment', filename=filename)
            message.attach(attachment)
            print(f"📎 Attached: {filename}")
        except Exception as e:
            print(f"⚠️ Could not attach file: {e}")

    # --- SEND EMAIL ---
    context = ssl.create_default_context()
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
            server.login(sender_email, app_password)
            server.sendmail(sender_email, recipient_email, message.as_string())
        print("Message with attachment beamed to Earth!")
    except Exception as e:
        print(f"Transmission failed: {e}")


def getSessionData(session_key):
    conf = configLoader()
    path = conf['jsonPath']['path']
    file = conf['jsonPath']['file']
    path_file = os.path.join(path, file)
    with open(path_file, "r") as f:
        all_sessions = json.load(f)
    session_data = all_sessions.get(session_key, {})
    file_path = f"data/{session_key}_report.txt"
    with open(file_path, "w") as f:
        json.dump(session_data, f, indent=2)
    return file_path

# --- EXAMPLE USAGE ---
if __name__ == "__main__":
    # Ensure this file actually exists in your folder!
    pdf_to_send = "mars_productivity_report.pdf" 
    
    send_astro_email(
        "shankarnarayana92@gmail.com", 
        "<h2>Weekly Report Attached</h2>",
        file_path=pdf_to_send
    )