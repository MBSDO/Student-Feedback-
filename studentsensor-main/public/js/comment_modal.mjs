import { API } from '/js/utilities.mjs';
import { Comment } from '/js/comment.mjs';

export class CommentModal {
    constructor(report, id) {
        this.report = report;
        this.comments = [];
        const modalOptions = {};
        this.rid = window.location.pathname.split('/').pop();
        this.modalElement = document.getElementById(id);
        this.inputElement = this.modalElement.querySelector('[role="input-area"]');
        this.previewElement = this.modalElement.querySelector('[role="preview-area"]');
        this.previewButton = this.modalElement.querySelector('[role="preview-button"]');
        this.submitButton = this.modalElement.querySelector('[role="submit-button"]');
        this.cancelButton = this.modalElement.querySelector('[role="cancel-button"]');
        this.csvUpload = this.modalElement.querySelector('[role="csv-upload"]');
        this.modal = new bootstrap.Modal(this.modalElement, modalOptions);
        this.Init();
    }
    Init() {
        this.modalElement.addEventListener('shown.bs.modal', () => {
            this.inputElement.value = '';
            this.Reset();
        });
        this.previewButton.addEventListener('click', () => {
            this.PreviewComments();
        });
        this.submitButton.addEventListener('click', () => {
            this.SubmitComments();
        });
        this.cancelButton.addEventListener('click', () => {
            this.Cancel();
        });
        this.csvUpload.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                this.inputElement.value = this.CleanCSV(text).join('\n');
                this.PreviewComments();
            };
            reader.readAsText(file);

        });
    }
    Reset() {
        this.previewElement.innerHTML = '';
        this.previewElement.classList.add('d-none');
        this.inputElement.classList.remove('d-none');
        this.inputElement.classList.remove('is-invalid');
        this.previewButton.classList.remove('d-none');
        this.submitButton.classList.add('d-none');
        this.inputElement.focus();
    }
    Cancel() {
        if(!this.submitButton.classList.contains('d-none')) {
            this.Reset();
            return;
        } else {
            this.modal.hide();
        }
    }
    PreviewComments() {
        this.previewButton.classList.add('d-none');
        this.submitButton.classList.remove('d-none');
        this.inputElement.classList.add('d-none');
        this.previewElement.classList.remove('d-none');
        this.previewElement.innerHTML = '';
        this.comments = [];
        const commentText = this.inputElement.value;
        const comments = commentText.split(/\r?\n/);
        comments.forEach(line => {
            if (line.length === 0) return;
            this.comments.push(line);
            const div = document.createElement('div');
            div.classList.add('d-flex', 'justify-content-between', 'align-items-center');
            this.previewElement.appendChild(div);
            const text = document.createElement('span');
            text.innerText = line;
            div.appendChild(text);
            const button = document.createElement('button');
            button.classList.add('btn', 'btn-byu-burgundy', 'bi-trash', 'px-2', 'ms-3');
            button.addEventListener('click', () => {
                div.remove();
                this.comments = this.comments.filter(c => c !== line);
            });
            div.appendChild(button);
        });
        this.inputElement.classList.add('d-none');
        this.previewElement.classList.remove('d-none');
    }
    async SubmitComments() {
        if(this.submitButton.disabled) return;
        this.submitButton.disabled = true;
        const batchSize = 50;
        for (let i = 0; i < this.comments.length; i += batchSize) {
            const batch = this.comments.slice(i, i + batchSize);
            console.log('Submitting batch:', batch);
            const result = await API('/report/' + this.rid + '/comments/create/batch', batch);
            result.forEach(db_comment => {
                const comment = new Comment(this.report);
                comment.Populate(db_comment);
                this.report.comments.push(comment);
                this.report.RenderComment(comment);
            });
        }
        this.submitButton.disabled = false;
        this.modal.hide();
        if(!this.report.processing) this.report.ProcessComments();
    }
    CleanCSV(text) {
        const rows = text.split(/\r?\n/).map(line => {
            const result = [];
            let current = '';
            // Determine the delimiter (comma or tab)
            const delimiter = line.includes('\t') ? '\t' : ',';
            let inQuotes = false;

            for (let char of line) {
                if (delimiter === '\t') {
                    if (char === delimiter) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                } else {
                    if (char === '"' && (current[current.length - 1] !== '\\' || current[current.length - 2] === '\\')) {
                        inQuotes = !inQuotes;
                    } else if (char === delimiter && !inQuotes) {
                        result.push(current.trim());
                        current = '';
                    } else {
                        current += char;
                    }
                }
            }
            const trimmed = current.trim();
            if (trimmed.startsWith("Question:") || trimmed.length === 0) return result;
            result.push(trimmed);
            return result;
        });
        let maxLength = 0;
        let columnIndex = -1;

        rows.forEach(row => {
            row.forEach((cell, index) => {
                if (cell.length > maxLength) {
                    maxLength = cell.length;
                    columnIndex = index;
                }
                console.log(row);
            });
        });

        const columnValues = rows.map(row => row[columnIndex] || '');
        return columnValues;
    }
}